import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { formatCurrency, translateBarcode } from "../utils";
import BillSummary from "./BillSummary";
import { supabase } from "../supabaseClient";
import { Header } from "./SharedUI";
import BillItemRow from "./BillItemRow";
import { useParams } from "react-router-dom";
import { handlePrint } from "./PrintService";

const SCAN_THRESHOLD_MS = 100;

const EditBillView = ({
  bills = [],
  products = [],
  loadData,
  putData,
  navigateTo,
  setShowPopup,
  setPopupContent,
  setSidebarOpen,
}) => {
  const { id } = useParams();

  const billToEdit = useMemo(
    () => bills.find((b) => String(b.id) === String(id)),
    [bills, id]
  );
  const draftKey = `draft_edit_${id}`;

  /* ===== hooks ทั้งหมดต้องอยู่บนสุด ห้ามมี early return คั่น ===== */
  const [customer, setCustomer] = useState("");
  const [customerDetail, setCustomerDetail] = useState("");
  const [billItems, setBillItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [printSize, setPrintSize] = useState("receipt");
  const [promotions, setPromotions] = useState([]);
  const [isHydrated, setIsHydrated] = useState(false);

  const barcodeBufferRef = useRef("");
  const lastKeyTimeRef = useRef(0);
  const isProcessingRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    loadData?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ โหลดค่าเริ่มต้นเมื่อบิลมาถึง + migrate reservedQty ให้บิลเก่า
  useEffect(() => {
    if (!billToEdit || isHydrated) return;

    setCustomer(billToEdit.customer || "");
    setCustomerDetail(billToEdit.customer_detail || "");
    setPrintSize(billToEdit.print_size || "receipt");

    let items;
    try {
      items = JSON.parse(localStorage.getItem(draftKey) || "null") || billToEdit.items || [];
    } catch {
      items = billToEdit.items || [];
    }

    setBillItems(
      (Array.isArray(items) ? items : []).map((i) => ({
        ...i,
        reservedQty: Number(i.reservedQty ?? i.qty) || 0,
      }))
    );
    setIsHydrated(true);
  }, [billToEdit, draftKey, isHydrated]);

  // ✅ เขียน draft เฉพาะหลัง hydrate แล้ว กันเขียนทับด้วย array ว่าง
  useEffect(() => {
    if (!isHydrated) return;
    localStorage.setItem(draftKey, JSON.stringify(billItems));
  }, [billItems, draftKey, isHydrated]);

  const clearDraft = useCallback(() => localStorage.removeItem(draftKey), [draftKey]);

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

    discount = Math.max(0, Math.min(discount, subTotal));
    return { subTotal, totalsale: subTotal - discount, discount, activePromos };
  }, [billItems, promotions]);

  /* ---------------- จัดการจำนวน / สต็อก ---------------- */
  const updateItemQty = async (productId, delta, isSet = false) => {
    const item = billItems.find((i) => i.productId === productId);
    if (!item) return;

    const reserved = Number(item.reservedQty ?? item.qty) || 0;

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
      // ✅ ดึง stock สดจาก DB แทนการเชื่อ products props (ของเดิมใช้ข้อมูลค้าง)
      const { data: freshProduct, error: fetchErr } = await supabase
        .from("products")
        .select("stock")
        .eq("id", productId)
        .single();

      if (fetchErr) throw fetchErr;

      const currentStock = Number(freshProduct?.stock) || 0;
      const availableStock = currentStock + reserved;

      if (newQty > availableStock) {
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
          message: "สินค้านี้สต็อกหมดแล้วครับ ไม่สามารถเพิ่มลงบิลได้",
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
    if (isSubmitting || !billToEdit) return;

    if (billItems.length === 0) {
      setPopupContent({
        title: "⚠️ บิลว่างเปล่า",
        message: "กรุณาเพิ่มสินค้าลงในบิลก่อนบันทึกครับ",
        color: "red",
      });
      setShowPopup(true);
      return;
    }

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
      const cleanItems = normalizedItems.map(({ reservedQty, tempId, stock, ...rest }) => rest);

      const totalAmount = cleanItems.reduce((acc, i) => acc + i.price * i.qty, 0);
      const totalcost = cleanItems.reduce((acc, i) => acc + (Number(i.cost) || 0) * i.qty, 0);
      const netBeforeVat = totalAmount - discount;
      const total_net = options.vat?.enabled ? options.vat.totalWithVat : netBeforeVat;
      const profit = total_net - totalcost;

      const finalBill = {
        ...billToEdit,
        customer,
        customer_detail: customerDetail,
        items: cleanItems,
        totalsale: netBeforeVat,
        total_amount: totalAmount,
        totalcost,
        discount,
        total_net,
        profit,
        status: "completed",
        payment_details: options.paymentDetails ?? billToEdit.payment_details,
        print_size: options.printSize || printSize,
        activePromos,
      };

      await putData("bills", finalBill);
      clearDraft();
      await loadData?.();

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
              handlePrint(finalBill);
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

  /* ===== เช็คหลัง hooks ครบแล้วเท่านั้น ===== */
  if (!billToEdit) {
    return (
      <div className="p-10 text-center text-gray-500">
        <h2 className="text-xl">ไม่พบข้อมูลบิล หรือกำลังโหลดข้อมูล...</h2>
        <button
          onClick={() => navigateTo("/")}
          className="mt-4 p-2 px-4 bg-yellow-500 text-white rounded hover:bg-yellow-600"
        >
          กลับหน้าหลัก
        </button>
      </div>
    );
  }

  const billLabel =
    billToEdit.bill_number || billToEdit.billNumber || String(billToEdit.id).substring(0, 5);

  /* ---------------- UI ---------------- */
  return (
    <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
      <Header
        title={`✏️ แก้ไขบิล #${billLabel}`}
        onToggleSidebar={setSidebarOpen ? () => setSidebarOpen((prev) => !prev) : undefined}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-6 rounded-xl shadow-lg space-y-4">
            <h3 className="text-lg font-bold text-yellow-700">ข้อมูลลูกค้า / ช่าง</h3>
            <input
              type="text"
              placeholder="ชื่อลูกค้า / ชื่อช่าง"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-yellow-500 focus:border-yellow-500"
            />
            <textarea
              placeholder="รายละเอียดลูกค้า"
              value={customerDetail}
              onChange={(e) => setCustomerDetail(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-yellow-500 focus:border-yellow-500"
              rows="2"
            />

            <h3 className="text-lg font-bold text-yellow-700 pt-4">🔍 ค้นหาสินค้าเพื่อแก้ไขในบิล</h3>
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
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-yellow-500 focus:border-yellow-500"
            />

            {searchTerm && searchResults.length === 0 && (
              <p className="text-sm text-gray-400 px-1">ไม่พบสินค้าที่ตรงกับคำค้นหา</p>
            )}

            {searchTerm && searchResults.length > 0 && (
              <div className="bg-white border border-yellow-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                {searchResults.map((p) => {
                  const isOutOfStock = (Number(p.stock) || 0) <= 0;
                  return (
                    <div
                      key={p.id}
                      onClick={() => !isOutOfStock && addItemToBill(p)}
                      className={`flex justify-between items-center p-3 transition duration-100 border-b last:border-b-0 ${
                        isOutOfStock
                          ? "opacity-50 cursor-not-allowed bg-gray-100"
                          : "cursor-pointer hover:bg-yellow-100"
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
                      <span className="text-sm font-semibold text-yellow-600">
                        {formatCurrency(p.price)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg">
            <h3 className="text-xl font-bold text-yellow-700 mb-4 border-b pb-2">
              รายการสินค้าในบิล ({billItems.length} รายการ)
            </h3>
            <div className="space-y-3">
              {billItems.length === 0 ? (
                <p className="text-gray-500 text-center">ไม่มีสินค้าในบิลนี้</p>
              ) : (
                billItems.map((item) => (
                  <BillItemRow
                    key={item.tempId || `edit-${item.productId}`}
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
              theme="yellow"
              onSave={handleSaveBill}
              isSubmitting={isSubmitting}
              canSave={billItems.length > 0 && !isSubmitting}
              printSize={printSize}
              setPrintSize={setPrintSize}
              discount={discount}
              activePromos={activePromos}
              initialPaymentDetails={billToEdit.payment_details}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditBillView;
