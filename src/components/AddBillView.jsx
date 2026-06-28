import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Header } from "./SharedUI";
import { formatCurrency, translateBarcode } from "../utils";
import { putData } from "../api";
import BillItemRow from "./BillItemRow";
import BillSummary from "./BillSummary";
import { supabase } from "../supabaseClient";
import { handlePrint } from './PrintService';

const AddBillView = ({
  products,
  navigateTo,
  setPopupContent,
  setShowPopup,
  loadData,
}) => {
  const [billItems, setBillItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem('draft_add_items') || '[]'); }
    catch { return []; }
  });
  const [customer, setCustomer] = useState(() =>
    localStorage.getItem('draft_add_customer') || ""
  );
  const [customerDetail, setCustomerDetail] = useState(() =>
    localStorage.getItem('draft_add_customerDetail') || ""
  );
  const [amountReceived, setAmountReceived] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [printSize, setPrintSize] = useState("receipt");
  const [barcodeInput, setBarcodeInput] = useState("");
  const barcodeBufferRef = useRef("");
  const lastKeyTimeRef = useRef(0);
  const [promotions, setPromotions] = useState([]);

  useEffect(() => {
  loadData();
}, []);

  useEffect(() => {
    localStorage.setItem('draft_add_items', JSON.stringify(billItems));
  }, [billItems]);

  useEffect(() => {
    localStorage.setItem('draft_add_customer', customer);
  }, [customer]);

  useEffect(() => {
    localStorage.setItem('draft_add_customerDetail', customerDetail);
  }, [customerDetail]);

  // เพิ่มฟังก์ชัน clearDraft
  const clearDraft = () => {
    localStorage.removeItem('draft_add_items');
    localStorage.removeItem('draft_add_customer');
    localStorage.removeItem('draft_add_customerDetail');
  };

  useEffect(() => {
    const fetchPromotions = async () => {
      const { data } = await supabase.from('promotions').select('*');
      setPromotions(data || []);
    };
    fetchPromotions();
  }, []);

  const { subTotal, totalsale, discount, activePromos, setSidebarOpen } = useMemo(() => {
    let subTotal = billItems.reduce((acc, item) => acc + (item.price * item.qty), 0);
    let discount = 0;
    let activePromos = [];

    promotions.forEach(promo => {
      // 1. ลอจิก: โปรโมชั่นแบบซื้อครบ (Qty)
      if (promo.type === 'qty') {
        const itemInCart = billItems.find(i => i.productId === promo.items[0]?.id);
        if (itemInCart && itemInCart.qty >= promo.min_qty) {
          // --- ปรับตรงนี้ ---
          // หาจำนวนชุดที่ทำโปรโมชั่นได้ (เช่น 6 ชิ้น / 3 = 2 ชุด)
          const sets = Math.floor(itemInCart.qty / promo.min_qty);

          // ส่วนลดต่อ 1 ชุด = (ราคาต่อชิ้น * min_qty) - ราคาโปรโมชั่นชุดนั้น
          // สมมติ promo.discount_price คือราคาที่ต้องจ่ายต่อ 1 ชุด (เช่น 115)
          const discountPerSet = (itemInCart.price * promo.min_qty) - promo.discount_price;

          discount += (sets * discountPerSet);
          activePromos.push(`${promo.name} (${sets} ชุด)`);
        }
      }

      else if (promo.type === 'bundle') {
        // ใช้ .map เพื่อเช็คแต่ละรายการในโปรโมชั่น
        const possibleSets = promo.items.map(pItem => {
          const bItem = billItems.find(b => b.productId === pItem.id);

          // ตรงนี้สำคัญ: ถ้า pItem.qty ไม่มี ให้ใช้ 1 เสมอ
          const requiredQty = (pItem.qty && pItem.qty > 0) ? pItem.qty : 1;

          return bItem ? Math.floor(bItem.qty / requiredQty) : 0;
        });

        // หาค่าต่ำสุดเพื่อดูว่าทำโปรได้กี่ชุด
        const maxSets = Math.min(...possibleSets);

        if (maxSets > 0) {
          const bundleNormalPrice = promo.items.reduce((acc, pItem) => {
            const item = billItems.find(b => b.productId === pItem.id);
            const requiredQty = (pItem.qty && pItem.qty > 0) ? pItem.qty : 1;
            return acc + (item ? (item.price * requiredQty) : 0);
          }, 0);

          const discountPerSet = bundleNormalPrice - promo.discount_price;
          discount += (maxSets * discountPerSet);
          activePromos.push(`${promo.name} (${maxSets} ชุด)`);
        }
      }
    });

    return { subTotal, totalsale: subTotal - discount, discount, activePromos };
  }, [billItems, promotions]);

  const updateItemQty = async (productId, delta, isSet = false) => {
    const product = products.find((p) => p.id === productId);
    const item = billItems.find((i) => i.productId === productId);
    if (!product || !item) return;

    let newQty = isSet ? delta : item.qty + delta;
    if (newQty < 0) newQty = 0;

    const availableStock = (product.stock || 0) + item.qty;
    console.log(`[stock check] product.stock=${product.stock}, item.qty=${item.qty}, availableStock=${availableStock}, newQty=${newQty}`);

    if (newQty > availableStock) {
        setPopupContent({
            title: "⚠️ สินค้าไม่เพียงพอ",
            message: `ขออภัยครับ สินค้านี้มีสต็อกทั้งหมด ${availableStock} ชิ้นเท่านั้น`,
            color: "red"
        });
        setShowPopup(true);
        return;
    }

    setBillItems((prev) => prev.map((i) => (i.productId === productId ? { ...i, qty: newQty } : i)));

    if (!isSet) {
        const { error } = await supabase.rpc(
            delta > 0 ? "decrement_stock" : "increment_stock",
            { p_id: parseInt(productId), amount: Math.abs(delta) }
        );
        if (error) {
            setPopupContent({ title: "⚠️ ผิดพลาด", message: "ไม่สามารถอัปเดตสต็อกได้", color: "red" });
            setShowPopup(true);
            loadData();
        }
    }
};

  const addItemToBill = async (product) => {
    const existingItem = billItems.find((i) => i.productId === product.id);

    if (existingItem) {
        updateItemQty(product.id, 1);  // ✅ ให้ updateItemQty จัดการ stock check เอง
        return;
    }

    // เช็ค stock เฉพาะตอนเพิ่มสินค้าใหม่เท่านั้น (ยังไม่มีในบิล)
    if ((product.stock || 0) <= 0) {
        setPopupContent({ title: "❌ สินค้าหมด", message: "สินค้านี้สต็อกหมดแล้วครับ", color: "red" });
        setShowPopup(true);
        return;
    }

    const newItem = {
      productId: product.id,
      name: product.name,
      price: product.price,
      cost: product.cost,
      stock: product.stock,
      qty: 1,
      // ใช้ timestamp เป็น ID เสริมป้องกัน key ซ้ำกรณีเพิ่ม-ลบ-เพิ่ม เร็วๆ
      tempId: Date.now()
    };

    setBillItems((prev) => [...prev, newItem]);
    setSearchTerm("");

    const { error } = await supabase.rpc("decrement_stock", {
      p_id: product.id,
      amount: 1,
    });

    if (error) {
      setBillItems((prev) => prev.filter((item) => item.tempId !== newItem.tempId));
      setPopupContent({ title: "⚠️ สินค้าไม่เพียงพอ", message: "จำนวนสินค้าในสต็อกเหลือไม่พอให้ขายครับ", color: "red" });
      setShowPopup(true);
      return;
    }
    setSearchTerm("");
  };

  const removeItem = async (productId) => {
    const itemToRemove = billItems.find((i) => i.productId === productId);
    if (!itemToRemove) return;

    setBillItems((prev) => prev.filter((i) => i.productId !== productId));

    try {
      const { error } = await supabase.rpc("increment_stock", {
        p_id: productId,
        amount: itemToRemove.qty,
      });

      if (error) throw error;

      // อัปเดตข้อมูลให้เป็นปัจจุบันหลังจากสำเร็จ
      await loadData();
    } catch (error) {
      // ถ้า Database พัง ให้เด้ง item กลับมาที่ UI (Rollback)
      setBillItems((prev) => [...prev, itemToRemove]);
      setPopupContent({ title: "🚫 เกิดข้อผิดพลาด", message: "ไม่สามารถคืนสต็อกได้: " + error.message, color: "red" });
      setShowPopup(true);
    }
  };

  const handleSaveBill = async (options = {}) => {
    setIsSubmitting(true);
    const hasInvalidItem = billItems.some(item =>
      !item.qty || item.qty === 0 || item.qty === ""
    );

    if (billItems.length === 0) {
      setPopupContent({ title: "⚠️ บิลว่างเปล่า", message: "กรุณาเพิ่มสินค้าลงในบิลก่อนบันทึกครับ", color: "red" });
      setShowPopup(true);
      setIsSubmitting(false); // ต้อง reset state นี้ด้วย
      return;
    }

    if (hasInvalidItem) {
      setPopupContent({
        title: "❌ ข้อมูลไม่ครบ",
        message: "มีสินค้าบางรายการจำนวนเป็น 0 หรือยังไม่ได้ระบุจำนวน กรุณาตรวจสอบให้ครบถ้วนครับ",
        color: "red"
      });
      setShowPopup(true);
      setIsSubmitting(false); // ต้อง reset state นี้ด้วย
      return;
    }
    setPopupContent({
      title: "⏳ กำลังบันทึกข้อมูล...",
      message: "ระบบกำลังประมวลผลบิลของคุณ กรุณารอสักครู่ครับ",
      isLoading: true,
      color: "green",
      actions: []
    });
    setShowPopup(true);
    try {
      const totalAmount = billItems.reduce((acc, item) => acc + (item.price * item.qty), 0);
      const totalcost = billItems.reduce((acc, item) => acc + (item.cost * item.qty), 0);
      const total_net = totalAmount - discount;
      const profit = total_net - totalcost;

      const finalBill = {
        date: new Date().toISOString(),
        customer,
        customer_detail: customerDetail,
        items: billItems,
        totalsale: totalAmount,
        total_amount: totalAmount,
        totalcost: totalcost,
        discount: discount,
        total_net: total_net,
        profit: profit,
        status: "completed",
        payment_details: options.paymentDetails,
        print_size: options.printSize,
        activePromos: activePromos,
      };
      await putData("bills", finalBill);
      await loadData();
      clearDraft();
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
            }
          },
          {
            label: "ปิดหน้าต่าง",
            handler: () => { setShowPopup(false); navigateTo("/"); }
          }
        ]
      });
      navigateTo("/");
    } catch (e) {
      setPopupContent({
        title: "🚫 บันทึกข้อมูลไม่สำเร็จ",
        message: "พบปัญหาขณะบันทึกบิล: " + e.message,
        isLoading: false,
        color: "red",
        actions: [{ label: "ปิด", handler: () => setShowPopup(false) }]
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const searchResults = useMemo(() => {
    if (!searchTerm) return [];
    const normalizedSearch = searchTerm.toLowerCase().replace(/\s+/g, '');

    return products.filter((p) => {
      const normalizedName = p.name.toLowerCase().replace(/\s+/g, '');
      const isMatch = normalizedName.includes(normalizedSearch);
      const isNotInBill = !billItems.find((i) => i.productId === p.id);

      return isMatch && isNotInBill;
    })
      .sort((a, b) => {
        // ใช้ localeCompare ของ JavaScript เพื่อเรียงลำดับภาษาไทยและอังกฤษได้อย่างถูกต้อง
        return a.name.localeCompare(b.name, 'th', { sensitivity: 'base' });
      });
  }, [searchTerm, products, billItems]);

  const handleBarcodeScan = useCallback((barcode) => {
    const translatedBarcode = translateBarcode(barcode);
    const foundProduct = products.find(
      (p) => String(p.id) === String(translatedBarcode) || String(p.barcode) === String(barcode)
    );

    if (foundProduct) {
      addItemToBill(foundProduct); // ตอนนี้จะไม่มี Error แล้ว
    } else {
      setPopupContent({
        title: "🔍 ไม่พบสินค้า",
        message: `ไม่พบสินค้าที่มีบาร์โค้ด: ${translatedBarcode}`,
        color: "yellow"
      });
      setShowPopup(true);
    }
  }, [products, addItemToBill, setPopupContent, setShowPopup]);

  useEffect(() => {
    const handleScanner = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

      const currentTime = Date.now();
      if (currentTime - lastKeyTimeRef.current > 100) {
        barcodeBufferRef.current = "";
      }
      lastKeyTimeRef.current = currentTime;

      if (e.key === "Enter") {
        e.preventDefault();
        if (barcodeBufferRef.current) {
          handleBarcodeScan(barcodeBufferRef.current);
          barcodeBufferRef.current = "";
        }
      } else {
        barcodeBufferRef.current += e.key;
      }
    };

    window.addEventListener("keypress", handleScanner);
    return () => window.removeEventListener("keypress", handleScanner);
  }, [handleBarcodeScan]);

  return (
    <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
      <Header title="🧾 สร้างบิลใหม่" onToggleSidebar={() => setSidebarOpen(prev => !prev)}/>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">

        {/* Left Column: Inputs & Search */}
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
              placeholder="พิมพ์ชื่อสินค้า..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
            />

            {/* Search Results (รวม Logic UI เก่า + สต็อกหมดจางๆ) */}
            {searchTerm && searchResults.length > 0 && (
              <div className="bg-white border border-green-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                {searchResults.map(p => {
                  const isOutOfStock = (p.stock || 0) <= 0;
                  return (
                    <div
                      key={p.id}
                      onClick={() => !isOutOfStock && addItemToBill(p)}
                      className={`flex justify-between items-center p-3 transition duration-100 border-b last:border-b-0 
                    ${isOutOfStock ? "opacity-50 cursor-not-allowed bg-gray-100" : "cursor-pointer hover:bg-green-100"}`}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-800">{p.name}</span>
                        <span className={`text-sm font-semibold ${isOutOfStock
                          ? "text-red-500"
                          : p.stock < 5
                            ? "text-red-500"
                            : "text-blue-600"
                          }`}>
                          {isOutOfStock ? "สินค้าหมด" : `คงเหลือ: ${p.stock} ${p.unit || 'ชิ้น'}`}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-green-600">{formatCurrency(p.price)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bill Items List (ใช้ Component เดิม) */}
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <h3 className="text-xl font-bold text-green-700 mb-4 border-b pb-2">รายการสินค้าในบิล ({billItems.length} รายการ)</h3>
            <div className="space-y-3">
              {billItems.length === 0 ? (
                <p className="text-gray-500 text-center">กรุณาเพิ่มสินค้าจากช่องค้นหาด้านบน</p>
              ) : (
                billItems.map(item => (
                  <BillItemRow
                    key={'bill-' + item.productId}
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

        {/* Right Column: Summary (ใช้ Component เดิม) */}
        <div className="lg:col-span-1">
          <div className="sticky top-20 min-w-[300px]">
            <BillSummary
              subTotal={subTotal}
              totalsale={totalsale}
              theme="green"
              onSave={(data) => handleSaveBill(data)}
              isSubmitting={isSubmitting}
              canSave={billItems.length > 0}
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
