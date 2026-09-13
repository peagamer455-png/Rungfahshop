import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Header } from "./SharedUI";
import { formatCurrency, translateBarcode } from "../utils";
import { putData } from "../api";
import BillItemRow from "./BillItemRow";
import BillSummary from "./BillSummary";
import { supabase } from "../supabaseClient";
import { handlePrint } from "./PrintService";

const SCAN_THRESHOLD_MS = 100;

const AddBillView = ({
  products = [],
  navigateTo,
  setPopupContent,
  setShowPopup,
  loadData,
  setSidebarOpen,
}) => {
  const [billItems, setBillItems] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("draft_add_items") || "[]");
      // migrate: เติม reservedQty ให้ draft เก่าที่ยังไม่มี field นี้
      return (Array.isArray(saved) ? saved : []).map((i) => ({
        ...i,
        reservedQty: Number(i.reservedQty ?? i.qty) || 0,
      }));
    } catch {
      return [];
    }
  });
  const [customer, setCustomer] = useState(
    () => localStorage.getItem("draft_add_customer") || ""
  );
  const [customerDetail, setCustomerDetail] = useState(
    () => localStorage.getItem("draft_add_customerDetail") || ""
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [printSize, setPrintSize] = useState("receipt");
  const [promotions, setPromotions] = useState([]);

  const barcodeBufferRef = useRef("");
  const lastKeyTimeRef = useRef(0);
  const isProcessingRef = useRef(false);   // กันกดรัว / สแกนซ้อน
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    loadData?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem("draft_add_items", JSON.stringify(billItems));
  }, [billItems]);

  useEffect(() => {
    localStorage.setItem("draft_add_customer", customer);
  }, [customer]);

  useEffect(() => {
    localStorage.setItem("draft_add_customerDetail", customerDetail);
  }, [customerDetail]);

  const clearDraft = useCallback(() => {
    localStorage.removeItem("draft_add_items");
    localStorage.removeItem("draft_add_customer");
    localStorage.removeItem("draft_add_customerDetail");
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchPromotions = async () => {
      const { data, error } = await supabase.from("promotions").select("*");
      if (!cancelled && !error) setPromotions(data || []);
    };
    fetchPromotions();
    return () => { cancelled = true; };
  }, []);

  /* ---------------- คำนวณยอด + โปรโมชั่น ---------------- */
  const { subTotal, totalsale, discount, activePromos } = useMemo(() => {
    const subTotal = billItems.reduce(
      (acc, item) => acc + (Number(item.price) || 0) * (Number(item.qty) || 0),
      0
    );
    let discount = 0;
    const activePromos = [];

    (promotions || []).forEach((promo) => {
      if (!promo || !Array.isArray(promo.items) || promo.items.length === 0) return;
      const promoPrice = Number(promo.discount_price) || 0;

      if (promo.type === "qty") {
        const minQty = Number(promo.min_qty) || 0;
        if (minQty <= 0) return;

        const itemInCart = billItems.find((i) => i.productId === promo.items[0]?.id);
        const cartQty = Number(itemInCart?.qty) || 0;
        if (!itemInCart || cartQty < minQty) return;

        const sets = Math.floor(cartQty / minQty);
        const discountPerSet = (Number(itemInCart.price) || 0) * minQty - promoPrice;
        if (sets > 0 && discountPerSet > 0) {
          discount += sets * discountPerSet;
          activePromos.push(`${promo.name} (${sets} ชุด)`);
        }
      } else if (promo.type === "bundle") {
        const possibleSets = promo.items.map((pItem) => {
          const bItem = billItems.find((b) => b.productId === pItem?.id);
          const requiredQty = Number(pItem?.qty) > 0 ? Number(pItem.qty) : 1;
          return bItem ? Math.floor((Number(bItem.qty) || 0) / requiredQty) : 0;
        });

        const maxSets = Math.min(...possibleSets);
        if (!Number.isFinite(maxSets) || maxSets <= 0) return;

        const bundleNormalPrice = promo.items.reduce((acc, pItem) => {
          const item = billItems.find((b) => b.productId === pItem?.id);
          const requiredQty = Number(pItem?.qty) > 0 ? Number(pItem.qty) : 1;
          return acc + (item ? (Number(item.price) || 0) * requiredQty : 0);
        }, 0);

        const discountPerSet = bundleNormalPrice - promoPrice;
        if (discountPerSet > 0) {
          discount += maxSets * discountPerSet;
          activePromos.push(`${promo.name} (${maxSets} ชุด)`);
        }
      }
    });

    discount = Math.max(0, Math.min(discount, subTotal));   // กันส่วนลดติดลบ/เกินยอด
    return { subTotal, totalsale: subTotal - discount, discount, activePromos };
  }, [billItems, promotions]);

  /* ---------------- จัดการจำนวน / สต็อก ---------------- */
  const updateItemQty = async (productId, delta, isSet = false) => {
    const item = billItems.find((i) => i.productId === productId);
    if (!item) return;

    // ✅ ฐานคำนวณคือจำนวนที่ "ตัดสต็อกไปแล้วจริง" ไม่ใช่ค่าที่แสดงในช่อง
    const reserved = Number(item.reservedQty ?? item.qty) || 0;

    // พิมพ์ช่องว่างชั่วคราว -> โชว์ว่าง แต่ reservedQty ยังอยู่ครบ
    if (isSet && (delta === "" || delta === null || Number.isNaN(Number(delta)))) {
      setBillItems((prev) =>
        prev.map((i) => (i.productId === productId ? { ...i, qty: "" } : i))
      );
      return;
    }

    let newQty = isSet ? Math.floor(Number(delta)) : reserved + Number(delta);
    if (!Number.isFinite(newQty) || newQty < 0) newQty = 0;

    const qtyDiff = newQty - reserved;
    if (qtyDiff === 0) {
      setBillItems((prev) =>
        prev.map((i) =>
          i.productId === productId ? { ...i, qty: newQty, reservedQty: newQty } : i
        )
      );
      return;
    }

    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    try {
      const { data: freshProduct, error: fetchErr } = await supabase
        .from("products")
        .select("stock")
        .eq("id", productId)
        .single();

      if (fetchErr) throw fetchErr;

      const currentStock = Number(freshProduct?.stock) || 0;
      const availableStock = currentStock + reserved;

      if (newQty > availableStock) {
        // ✅ ดึงช่องกลับเป็นค่าที่จองไว้จริง ไม่ปล่อยค้างว่าง
        setBillItems((prev) =>
          prev.map((i) =>
            i.productId === productId ? { ...i, qty: reserved, reservedQty: reserved } : i
          )
        );
        setPopupContent({
          title: "⚠️ สินค้าไม่เพียงพอ",
          message: `ขออภัยครับ สินค้านี้มีสต็อกทั้งหมด ${availableStock} ชิ้นเท่านั้น`,
          color: "red",
        });
        setShowPopup(true);
        return;
      }

      setBillItems((prev) =>
        prev.map((i) =>
          i.productId === productId ? { ...i, qty: newQty, reservedQty: newQty } : i
        )
      );

      const { error } = await supabase.rpc(
        qtyDiff > 0 ? "decrement_stock" : "increment_stock",
        { p_id: Number(productId), amount: Math.abs(qtyDiff) }
      );
      if (error) throw error;

      await loadData?.();
    } catch (err) {
      if (!isMountedRef.current) return;
      setBillItems((prev) =>
        prev.map((i) =>
          i.productId === productId ? { ...i, qty: reserved, reservedQty: reserved } : i
        )
      );
      setPopupContent({
        title: "⚠️ ผิดพลาด",
        message: "ไม่สามารถอัปเดตสต็อกได้: " + (err?.message || "กรุณาลองใหม่อีกครั้ง"),
        color: "red",
      });
      setShowPopup(true);
      await loadData?.();
    } finally {
      isProcessingRef.current = false;
    }
  };

  const addItemToBill = async (product) => {
    if (!product) return;

    const existingItem = billItems.find((i) => i.productId === product.id);
    if (existingItem) {
      await updateItemQty(product.id, 1);
      setSearchTerm("");
      return;
    }

    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    const newItem = {
      productId: product.id,
      name: product.name,
      price: Number(product.price) || 0,
      cost: Number(product.cost) || 0,
      unit: product.unit || "ชิ้น",
      qty: 1,
      reservedQty: 1,
      tempId: `${product.id}-${Date.now()}`,
    };

    try {
      const { data: freshProduct, error: fetchErr } = await supabase
        .from("products")
        .select("stock")
        .eq("id", product.id)
        .single();

      if (fetchErr) throw fetchErr;

      if ((Number(freshProduct?.stock) || 0) <= 0) {
        setPopupContent({
          title: "❌ สินค้าหมด",
          message: "สินค้านี้สต็อกหมดแล้วครับ",
          color: "red",
        });
        setShowPopup(true);
        return;
      }

      setBillItems((prev) => [...prev, newItem]);
      setSearchTerm("");

      const { error } = await supabase.rpc("decrement_stock", {
        p_id: Number(product.id),
        amount: 1,
      });
      if (error) throw error;

      await loadData?.();
    } catch (err) {
      if (!isMountedRef.current) return;
      setBillItems((prev) => prev.filter((i) => i.tempId !== newItem.tempId));
      setPopupContent({
        title: "⚠️ เพิ่มสินค้าไม่สำเร็จ",
        message: "จำนวนสินค้าในสต็อกเหลือไม่พอ หรือเกิดข้อผิดพลาด: " + (err?.message || ""),
        color: "red",
      });
      setShowPopup(true);
      await loadData?.();
    } finally {
      isProcessingRef.current = false;
    }
  };

  const removeItem = async (productId) => {
    const originalIndex = billItems.findIndex((i) => i.productId === productId);
    if (originalIndex === -1) return;
    const itemToRemove = billItems[originalIndex];

    // ✅ คืนสต็อกตามจำนวนที่ตัดไปจริง กัน NaN จากช่องว่าง
    const amountToReturn = Number(itemToRemove.reservedQty ?? itemToRemove.qty) || 0;

    setBillItems((prev) => prev.filter((i) => i.productId !== productId));
    if (amountToReturn <= 0) return;

    try {
      const { error } = await supabase.rpc("increment_stock", {
        p_id: Number(productId),
        amount: amountToReturn,
      });
      if (error) throw error;
      await loadData?.();
    } catch (error) {
      if (!isMountedRef.current) return;
      // ✅ rollback กลับตำแหน่งเดิม ไม่เด้งไปท้ายสุด
      setBillItems((prev) => {
        const next = [...prev];
        next.splice(originalIndex, 0, itemToRemove);
        return next;
      });
      setPopupContent({
        title: "🚫 เกิดข้อผิดพลาด",
        message: "ไม่สามารถคืนสต็อกได้: " + error.message,
        color: "red",
      });
      setShowPopup(true);
    }
  };

  /* ---------------- บันทึกบิล ---------------- */
  const handleSaveBill = async (options = {}) => {
    if (isSubmitting) return;

    if (billItems.length === 0) {
      setPopupContent({
        title: "⚠️ บิลว่างเปล่า",
        message: "กรุณาเพิ่มสินค้าลงในบิลก่อนบันทึกครับ",
        color: "red",
      });
      setShowPopup(true);
      return;
    }

    // ✅ safety net: ช่องที่ค้างว่าง ให้ดึงกลับเป็นจำนวนที่จองไว้จริง
    const normalizedItems = billItems.map((item) => {
      const qty = Number(item.qty);
      const fallback = Number(item.reservedQty) || 0;
      return { ...item, qty: Number.isFinite(qty) && qty > 0 ? qty : fallback };
    });

    const hasInvalidItem = normalizedItems.some((item) => !item.qty || item.qty <= 0);
    if (hasInvalidItem) {
      setBillItems(normalizedItems);
      setPopupContent({
        title: "❌ ข้อมูลไม่ครบ",
        message: "มีสินค้าบางรายการจำนวนเป็น 0 หรือยังไม่ได้ระบุจำนวน กรุณาตรวจสอบให้ครบถ้วนครับ",
        color: "red",
      });
      setShowPopup(true);
      return;
    }

    setIsSubmitting(true);
    setPopupContent({
      title: "⏳ กำลังบันทึกข้อมูล...",
      message: "ระบบกำลังประมวลผลบิลของคุณ กรุณารอสักครู่ครับ",
      isLoading: true,
      color: "green",
      actions: [],
    });
    setShowPopup(true);

    try {
      // ✅ ตัด field ชั่วคราวออกก่อนลง DB
      const cleanItems = normalizedItems.map(({ reservedQty, tempId, stock, ...rest }) => rest);

      const totalAmount = cleanItems.reduce((acc, i) => acc + i.price * i.qty, 0);
      const totalcost = cleanItems.reduce((acc, i) => acc + (Number(i.cost) || 0) * i.qty, 0);
      const netBeforeVat = totalAmount - discount;
      const total_net = options.vat?.enabled ? options.vat.totalWithVat : netBeforeVat;
      const profit = total_net - totalcost;

      const finalBill = {
        date: new Date().toISOString(),
        customer,
        customer_detail: customerDetail,
        items: cleanItems,
        totalsale: netBeforeVat,        // ยอดหลังหักส่วนลด
        total_amount: totalAmount,      // ยอดก่อนหักส่วนลด
        totalcost,
        discount,
        total_net,
        profit,
        status: "completed",
        payment_details: options.paymentDetails,
        print_size: options.printSize || printSize,
        activePromos,
      };

      const savedId = await putData("bills", finalBill);
      const billForPrint = savedId
        ? { ...finalBill, id: savedId, bill_number: savedId }
        : finalBill;

      clearDraft();
      setBillItems([]);
      setCustomer("");
      setCustomerDetail("");
      await loadData?.();

      // ✅ ไม่ navigate ทันที ปล่อยให้ผู้ใช้เลือกจาก popup
      setPopupContent({
        title: "✅ บันทึกสำเร็จ",
        message: "ระบบได้ทำการบันทึกบิลเรียบร้อยแล้วครับ",
        isLoading: false,
        color: "green",
        actions: [
          {
            label: "🖨️ พิมพ์บิลทันที",
            variant: "success",
            handler: () => {
              handlePrint(billForPrint);
              setShowPopup(false);
              navigateTo("/");
            },
          },
          {
            label: "ปิดหน้าต่าง",
            handler: () => {
              setShowPopup(false);
              navigateTo("/");
            },
          },
        ],
      });
    } catch (e) {
      setPopupContent({
        title: "🚫 บันทึกข้อมูลไม่สำเร็จ",
        message: "พบปัญหาขณะบันทึกบิล: " + e.message,
        isLoading: false,
        color: "red",
        actions: [{ label: "ปิด", handler: () => setShowPopup(false) }],
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ---------------- ค้นหา ---------------- */
  const searchResults = useMemo(() => {
    const term = searchTerm.trim();
    if (!term) return [];
    const normalizedSearch = term.toLowerCase().replace(/\s+/g, "");

    return products
      .filter((p) => {
        if (!p?.name) return false;
        const normalizedName = p.name.toLowerCase().replace(/\s+/g, "");
        const isMatch = normalizedName.includes(normalizedSearch);
        const isNotInBill = !billItems.some((i) => i.productId === p.id);
        return isMatch && isNotInBill;
      })
      .sort((a, b) => a.name.localeCompare(b.name, "th", { sensitivity: "base" }))
      .slice(0, 50);
  }, [searchTerm, products, billItems]);

  /* ---------------- บาร์โค้ด ---------------- */
  const handleBarcodeScan = useCallback(
    (code) => {
      const raw = String(code).trim();
      const translated = String(translateBarcode(code)).trim();

      let foundProduct = products.find((p) => {
        if (!p.barcode) return false;
        const pBarcode = String(p.barcode).trim();
        return pBarcode === raw || pBarcode === translated;
      });

      if (!foundProduct) {
        foundProduct = products.find((p) => {
          const pId = String(p.id).trim();
          return pId === translated || pId === raw;
        });
      }

      if (foundProduct) {
        addItemToBill(foundProduct);
      } else {
        setPopupContent({
          title: "🔍 ไม่พบสินค้า",
          message: `ไม่พบสินค้าที่มีบาร์โค้ด/รหัส: ${code}`,
          color: "yellow",
        });
        setShowPopup(true);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products, billItems]
  );

  const handleBarcodeScanRef = useRef(handleBarcodeScan);
  useEffect(() => {
    handleBarcodeScanRef.current = handleBarcodeScan;
  }, [handleBarcodeScan]);

  useEffect(() => {
    const handleScanner = (e) => {
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable) return;

      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTimeRef.current;

      if (e.key === "Enter") {
        if (barcodeBufferRef.current.length >= 1) {
          e.preventDefault();
          handleBarcodeScanRef.current(barcodeBufferRef.current);
          barcodeBufferRef.current = "";
        }
        lastKeyTimeRef.current = 0;
        return;
      }

      if (e.key.length !== 1 || e.ctrlKey || e.altKey || e.metaKey) return;

      barcodeBufferRef.current =
        timeDiff < SCAN_THRESHOLD_MS ? barcodeBufferRef.current + e.key : e.key;
      lastKeyTimeRef.current = currentTime;
    };

    window.addEventListener("keydown", handleScanner);
    return () => window.removeEventListener("keydown", handleScanner);
  }, []);

  /* ---------------- UI ---------------- */
  return (
    <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
      <Header
        title="🧾 สร้างบิลใหม่"
        onToggleSidebar={setSidebarOpen ? () => setSidebarOpen((prev) => !prev) : undefined}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-6 rounded-xl shadow-lg space-y-4">
            <h3 className="text-lg font-bold text-green-700">ข้อมูลลูกค้า / ช่าง</h3>
            <input
              type="text"
              placeholder="ชื่อลูกค้า / ชื่อช่าง (ไม่บังคับ)"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
            />
            <textarea
              placeholder="รายละเอียดลูกค้า (ไม่บังคับ)"
              value={customerDetail}
              onChange={(e) => setCustomerDetail(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
              rows="2"
            />

            <h3 className="text-lg font-bold text-green-700 pt-4">🔍 ค้นหาสินค้าเพื่อเพิ่มในบิล</h3>
            <input
              type="text"
              placeholder="พิมพ์ชื่อสินค้า หรือสแกนบาร์โค้ด..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && searchTerm.trim().length > 0) {
                  e.preventDefault();
                  handleBarcodeScanRef.current(searchTerm.trim());
                  setSearchTerm("");
                }
              }}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
            />

            {searchTerm && searchResults.length === 0 && (
              <p className="text-sm text-gray-400 px-1">ไม่พบสินค้าที่ตรงกับคำค้นหา</p>
            )}

            {searchTerm && searchResults.length > 0 && (
              <div className="bg-white border border-green-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                {searchResults.map((p) => {
                  const isOutOfStock = (Number(p.stock) || 0) <= 0;
                  return (
                    <div
                      key={p.id}
                      onClick={() => !isOutOfStock && addItemToBill(p)}
                      className={`flex justify-between items-center p-3 transition duration-100 border-b last:border-b-0 ${
                        isOutOfStock
                          ? "opacity-50 cursor-not-allowed bg-gray-100"
                          : "cursor-pointer hover:bg-green-100"
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-800">{p.name}</span>
                        <span
                          className={`text-sm font-semibold ${
                            isOutOfStock || p.stock < 5 ? "text-red-500" : "text-blue-600"
                          }`}
                        >
                          {isOutOfStock ? "สินค้าหมด" : `คงเหลือ: ${p.stock} ${p.unit || "ชิ้น"}`}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-green-600">
                        {formatCurrency(p.price)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg">
            <h3 className="text-xl font-bold text-green-700 mb-4 border-b pb-2">
              รายการสินค้าในบิล ({billItems.length} รายการ)
            </h3>
            <div className="space-y-3">
              {billItems.length === 0 ? (
                <p className="text-gray-500 text-center">กรุณาเพิ่มสินค้าจากช่องค้นหาด้านบน</p>
              ) : (
                billItems.map((item) => (
                  <BillItemRow
                    key={item.tempId || `bill-${item.productId}`}
                    item={item}
                    onUpdateQty={updateItemQty}
                    onRemove={removeItem}
                    setPopupContent={setPopupContent}
                    setShowPopup={setShowPopup}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-20 min-w-[300px]">
            <BillSummary
              subTotal={subTotal}
              totalsale={totalsale}
              theme="green"
              onSave={handleSaveBill}
              isSubmitting={isSubmitting}
              canSave={billItems.length > 0 && !isSubmitting}
              printSize={printSize}
              setPrintSize={setPrintSize}
              discount={discount}
              activePromos={activePromos}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddBillView;
