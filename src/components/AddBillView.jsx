import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Header } from "./SharedUI";
import { formatCurrency, translateBarcode } from "../utils";
import { calcBillTotals, normalizeItems, toDbItems } from "../utils/billCalc";
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
      return Array.isArray(saved)
        ? saved.map((i) => ({ ...i, lastQty: Number(i.lastQty ?? i.qty) || 1 }))
        : [];
    } catch {
      return [];
    }
  });
  const [customer, setCustomer] = useState(() => localStorage.getItem("draft_add_customer") || "");
  const [customerDetail, setCustomerDetail] = useState(
    () => localStorage.getItem("draft_add_customerDetail") || ""
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [printSize, setPrintSize] = useState("receipt");
  const [promotions, setPromotions] = useState([]);

  const barcodeBufferRef = useRef("");
  const lastKeyTimeRef = useRef(0);

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
    (async () => {
      const { data, error } = await supabase.from("promotions").select("*");
      if (!cancelled && !error) setPromotions(data || []);
    })();
    return () => { cancelled = true; };
  }, []);

  const { subTotal, totalsale, discount, activePromos } = useMemo(
    () => calcBillTotals(billItems, promotions),
    [billItems, promotions]
  );

  // ✅ สต็อกที่ขายได้ = ค่าใน DB ตรงๆ (ยังไม่มีการตัดล่วงหน้าแล้ว)
  const getAvailableStock = useCallback(
    (productId) => Number(products.find((p) => p.id === productId)?.stock) || 0,
    [products]
  );

  const warnStock = (available) => {
    setPopupContent({
      title: "⚠️ สินค้าไม่เพียงพอ",
      message: `ขออภัยครับ สินค้านี้มีสต็อกทั้งหมด ${available} ชิ้นเท่านั้น`,
      color: "red",
    });
    setShowPopup(true);
  };

  /* ---------- ทุกฟังก์ชันด้านล่างเป็น local ล้วน ไม่แตะ DB ---------- */

  const updateItemQty = (productId, delta, isSet = false) => {
    setBillItems((prev) => {
      const item = prev.find((i) => i.productId === productId);
      if (!item) return prev;

      const base = Number(item.qty);
      const safeBase = Number.isFinite(base) && base > 0 ? base : Number(item.lastQty) || 0;

      // พิมพ์ช่องว่างชั่วคราว -> โชว์ว่างไว้ แต่จำค่าเดิมใน lastQty
      if (isSet && (delta === "" || delta === null || Number.isNaN(Number(delta)))) {
        return prev.map((i) =>
          i.productId === productId ? { ...i, qty: "", lastQty: safeBase || 1 } : i
        );
      }

      let newQty = isSet ? Math.floor(Number(delta)) : safeBase + Number(delta);
      if (!Number.isFinite(newQty) || newQty < 0) newQty = 0;

      const available = getAvailableStock(productId);
      if (newQty > available) {
        warnStock(available);
        return prev.map((i) =>
          i.productId === productId ? { ...i, qty: available, lastQty: available } : i
        );
      }

      return prev.map((i) =>
        i.productId === productId
          ? { ...i, qty: newQty, lastQty: newQty > 0 ? newQty : i.lastQty }
          : i
      );
    });
  };

  const addItemToBill = (product) => {
    if (!product) return;

    const exists = billItems.some((i) => i.productId === product.id);
    if (exists) {
      updateItemQty(product.id, 1);
      setSearchTerm("");
      return;
    }

    const available = getAvailableStock(product.id);
    if (available <= 0) {
      setPopupContent({ title: "❌ สินค้าหมด", message: "สินค้านี้สต็อกหมดแล้วครับ", color: "red" });
      setShowPopup(true);
      return;
    }

    setBillItems((prev) => [
      ...prev,
      {
        productId: product.id,
        name: product.name,
        price: Number(product.price) || 0,
        cost: Number(product.cost) || 0,
        unit: product.unit || "ชิ้น",
        qty: 1,
        lastQty: 1,
        tempId: `${product.id}-${Date.now()}`,
      },
    ]);
    setSearchTerm("");
  };

  // ✅ ลบทันที ไม่ต้องรอ network ไม่มีอะไรให้ rollback
  const removeItem = (productId) => {
    setBillItems((prev) => prev.filter((i) => i.productId !== productId));
  };

  /* ---------------- บันทึก: ตัดสต็อก + เขียนบิล ในครั้งเดียว ---------------- */
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

    const normalized = normalizeItems(billItems);
    if (normalized.some((i) => !i.qty || i.qty <= 0)) {
      setBillItems(normalized);
      setPopupContent({
        title: "❌ ข้อมูลไม่ครบ",
        message: "มีสินค้าบางรายการจำนวนเป็น 0 กรุณาตรวจสอบให้ครบถ้วนครับ",
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
      const dbItems = toDbItems(normalized);
      const totals = calcBillTotals(dbItems, promotions);

      const totalAmount = totals.subTotal;
      const totalcost = dbItems.reduce((a, i) => a + (Number(i.cost) || 0) * i.qty, 0);
      const netBeforeVat = totalAmount - totals.discount;
      const total_net = options.vat?.enabled ? options.vat.totalWithVat : netBeforeVat;

      const billPayload = {
        date: new Date().toISOString(),
        customer,
        customer_detail: customerDetail,
        totalsale: netBeforeVat,
        total_amount: totalAmount,
        totalcost,
        discount: totals.discount,
        total_net,
        profit: total_net - totalcost,
        status: "completed",
        payment_details: options.paymentDetails ?? null,
        print_size: options.printSize || printSize,
        activePromos: totals.activePromos,
      };

      // 🔒 ตัดสต็อก + บันทึกบิล ใน transaction เดียว
      const { data: savedId, error } = await supabase.rpc("save_bill_with_stock", {
        p_bill_id: null,
        p_bill: billPayload,
        p_items: dbItems,
      });
      if (error) throw error;

      const billForPrint = { ...billPayload, items: dbItems, id: savedId, bill_number: savedId };

      clearDraft();
      setBillItems([]);
      setCustomer("");
      setCustomerDetail("");
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
            handler: () => { handlePrint(billForPrint); setShowPopup(false); navigateTo("/"); },
          },
          { label: "ปิดหน้าต่าง", handler: () => { setShowPopup(false); navigateTo("/"); } },
        ],
      });
    } catch (e) {
      await loadData?.();
      setPopupContent({
        title: "🚫 บันทึกข้อมูลไม่สำเร็จ",
        message: e.message || "พบปัญหาขณะบันทึกบิล",
        isLoading: false,
        color: "red",
        actions: [{ label: "ปิด", handler: () => setShowPopup(false) }],
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ---------------- ค้นหา / บาร์โค้ด ---------------- */
  const searchResults = useMemo(() => {
    const term = searchTerm.trim();
    if (!term) return [];
    const q = term.toLowerCase().replace(/\s+/g, "");
    return products
      .filter((p) => {
        if (!p?.name) return false;
        return (
          p.name.toLowerCase().replace(/\s+/g, "").includes(q) &&
          !billItems.some((i) => i.productId === p.id)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name, "th", { sensitivity: "base" }))
      .slice(0, 50);
  }, [searchTerm, products, billItems]);

  const handleBarcodeScan = useCallback(
    (code) => {
      const raw = String(code).trim();
      const translated = String(translateBarcode(code)).trim();

      let found = products.find((p) => {
        if (!p.barcode) return false;
        const b = String(p.barcode).trim();
        return b === raw || b === translated;
      });
      if (!found) {
        found = products.find((p) => {
          const pid = String(p.id).trim();
          return pid === translated || pid === raw;
        });
      }

      if (found) addItemToBill(found);
      else {
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

  const scanRef = useRef(handleBarcodeScan);
  useEffect(() => { scanRef.current = handleBarcodeScan; }, [handleBarcodeScan]);

  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable) return;

      const now = Date.now();
      const diff = now - lastKeyTimeRef.current;

      if (e.key === "Enter") {
        if (barcodeBufferRef.current.length >= 1) {
          e.preventDefault();
          scanRef.current(barcodeBufferRef.current);
          barcodeBufferRef.current = "";
        }
        lastKeyTimeRef.current = 0;
        return;
      }
      if (e.key.length !== 1 || e.ctrlKey || e.altKey || e.metaKey) return;

      barcodeBufferRef.current = diff < SCAN_THRESHOLD_MS ? barcodeBufferRef.current + e.key : e.key;
      lastKeyTimeRef.current = now;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ---------------- UI ---------------- */
  return (
    <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
      <Header
        title="🧾 สร้างบิลใหม่"
        onToggleSidebar={setSidebarOpen ? () => setSidebarOpen((p) => !p) : undefined}
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
                if (e.key === "Enter" && searchTerm.trim()) {
                  e.preventDefault();
                  scanRef.current(searchTerm.trim());
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
                  const out = (Number(p.stock) || 0) <= 0;
                  return (
                    <div
                      key={p.id}
                      onClick={() => !out && addItemToBill(p)}
                      className={`flex justify-between items-center p-3 border-b last:border-b-0 ${
                        out ? "opacity-50 cursor-not-allowed bg-gray-100" : "cursor-pointer hover:bg-green-100"
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-800">{p.name}</span>
                        <span className={`text-sm font-semibold ${out || p.stock < 5 ? "text-red-500" : "text-blue-600"}`}>
                          {out ? "สินค้าหมด" : `คงเหลือ: ${p.stock} ${p.unit || "ชิ้น"}`}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-green-600">{formatCurrency(p.price)}</span>
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
                    maxQty={getAvailableStock(item.productId)}
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
