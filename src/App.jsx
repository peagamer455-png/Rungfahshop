import React, { useState, useEffect, useCallback, useRef } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import { supabase } from "./supabaseClient";
import { Header, LoadingSpinner } from "./components/SharedUI.jsx";
import POSView from "./components/POSView";
import OverviewDashboard from "./components/OverviewDashboard";
import PromotionView from "./components/PromotionView";
import Sidebar from "./components/Sidebar";
import PasswordConfirmModal from "./components/PasswordConfirmModal";
import Popup from "./components/Popup";
import BillHistoryView from "./components/BillHistoryView";
import ProductManagerView from "./components/ProductManagerView";
import AddBillView from "./components/AddBillView";
import { formatCurrency } from "./utils";
import BillDetailView from "./components/BillDetailView";
import EditBillView from "./components/EditBillView";
import { useAuth } from "./contexts/AuthContext";
import Login from "./components/Login";

const BILLS_WINDOW_DAYS = 30;
const PAGE_SIZE = 1000; // Supabase ส่งได้สูงสุด 1000 แถวต่อครั้ง

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const sortBillsDesc = (list) =>
  [...list].sort((a, b) => new Date(b.date) - new Date(a.date));
const sameId = (a, b) => String(a) === String(b);
const upsertRow = (list, row) => {
  const i = list.findIndex((x) => sameId(x.id, row.id));
  if (i === -1) return [...list, row];
  const next = list.slice();
  next[i] = { ...list[i], ...row }; // merge กันกรณี payload ไม่มีคอลัมน์ใหญ่ที่ไม่ได้เปลี่ยน
  return next;
};
const mergeBills = (prev, incoming) => {
  let out = prev;
  incoming.forEach((b) => { out = upsertRow(out, b); });
  return sortBillsDesc(out);
};

// ดึงบิลช่วง [from, to) แบบแบ่งหน้า (กันโดนตัดที่ 1000 แถว)
const fetchBills = async (fromISO, toISO) => {
  const all = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let q = supabase
      .from("bills")
      .select("*")
      .gte("date", fromISO)
      .order("date", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (toISO) q = q.lt("date", toISO);
    const { data, error } = await q;
    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return all;
};

const fetchProducts = async () => {
  const { data, error } = await supabase.from("products").select("*");
  if (error) throw error;
  return data || [];
};

const fetchPromotions = async () => {
  const { data, error } = await supabase
    .from("promotions")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return data || [];
};

const App = () => {
  const { session, loading: authLoading } = useAuth();

  const [products, setProducts] = useState([]);
  const [bills, setBills] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [sensitiveVisible, setSensitiveVisible] = useState(false);
  const [isDbReady, setIsDbReady] = useState(false);
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const handleNavigate = (path) => {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    navigate(cleanPath);
  };

  const [showPopup, setShowPopup] = useState(false);
  const [popupContent, setPopupContent] = useState(null);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordOnSuccess, setPasswordOnSuccess] = useState(null);
  const [currentBillId, setCurrentBillId] = useState(null);
  const SENSITIVE_PASSWORD = "241114";

  // ───────────────────────────────────────────────────────────────────────────
  // 🔽 ลดการใช้ Supabase Egress
  //  - โหลดบิลย้อนหลังแค่ BILLS_WINDOW_DAYS วัน (บิลเก่ากว่านั้นโหลดเพิ่มตอนที่ผู้ใช้เลือกดูเท่านั้น)
  //  - realtime: อัปเดต state จาก payload โดยตรง ไม่ดึงข้อมูลทั้งหมดใหม่ทุก event
  //  - loadData() (ที่หน้าลูกเรียกหลังบันทึก) เบาลง: สินค้า + บิลของเมื่อวาน-วันนี้เท่านั้น
  //  - useEffect ผูกกับ userId ไม่ใช่ session ทั้งก้อน (กัน refetch ทุกครั้งที่ token refresh/สลับแท็บ)
  // ───────────────────────────────────────────────────────────────────────────
  const userId = session?.user?.id ?? null;
  const billsFromRef = useRef(null); // วันที่เก่าสุดของบิลที่โหลดมาแล้ว
  const softLoadRef = useRef(null);

  // โหลดเต็ม: ใช้ตอนเข้าระบบครั้งแรก
  const loadAll = useCallback(async () => {
    try {
      const from = startOfDay(Date.now() - BILLS_WINDOW_DAYS * 86400000);
      const [productsData, billsData, promotionsData] = await Promise.all([
        fetchProducts(),
        fetchBills(from.toISOString()),
        fetchPromotions(),
      ]);
      billsFromRef.current = from;
      setProducts(productsData);
      setBills(billsData);
      setPromotions(promotionsData);
      setIsDbReady(true);
    } catch (e) {
      console.error("Supabase load failed:", e);
      setPopupContent({
        title: "🚫 พบปัญหาการเชื่อมต่อ",
        message: "ไม่สามารถเชื่อมต่อฐานข้อมูลได้ในขณะนี้ โปรดตรวจสอบการเชื่อมต่ออินเทอร์เน็ตของท่านแล้วลองใหม่อีกครั้งครับ",
        color: "red"
      });
      setShowPopup(true);
      setIsDbReady(true);
    }
  }, []);

  // โหลดแบบเบา: หน้าลูกเรียกหลังบันทึก/ลบ (สินค้า + บิลตั้งแต่เมื่อวาน)
  // บิลที่เก่ากว่านั้นอัปเดตผ่าน realtime อยู่แล้ว
  const loadData = useCallback(() => {
    if (softLoadRef.current) return softLoadRef.current; // กันเรียกซ้อนกัน
    softLoadRef.current = (async () => {
      try {
        const since = startOfDay(Date.now() - 86400000);
        const [productsData, recentBills] = await Promise.all([
          fetchProducts(),
          fetchBills(since.toISOString()),
        ]);
        setProducts(productsData);
        setBills((prev) => {
          const older = prev.filter((b) => new Date(b.date) < since);
          return sortBillsDesc([...recentBills, ...older]);
        });
      } catch (e) {
        console.error("Supabase refresh failed:", e);
      } finally {
        softLoadRef.current = null;
      }
    })();
    return softLoadRef.current;
  }, []);

  const reloadPromotions = useCallback(async () => {
    try {
      setPromotions(await fetchPromotions());
    } catch (e) {
      console.error("Promotions refresh failed:", e);
    }
  }, []);

  // โหลดบิลเก่ากว่าที่มีอยู่ (เรียกเมื่อผู้ใช้เลือกดูวันที่ย้อนหลังไกล) → คืนบิลที่เพิ่งโหลดมา
  const ensureBillsFrom = useCallback(async (dateInput) => {
    try {
      const target = startOfDay(
        typeof dateInput === "string" && dateInput.length === 10
          ? `${dateInput}T00:00:00`
          : dateInput
      );
      const loadedFrom = billsFromRef.current;
      if (!loadedFrom || isNaN(target) || target >= loadedFrom) return [];
      const older = await fetchBills(target.toISOString(), loadedFrom.toISOString());
      billsFromRef.current = target;
      setBills((prev) => mergeBills(prev, older));
      return older;
    } catch (e) {
      console.error("Load older bills failed:", e);
      return [];
    }
  }, []);

  const putData = useCallback(async (table, data) => {
    try {
      const { error } = await supabase
        .from(table)
        .upsert(data);

      if (error) throw error;

      // อัปเดตข้อมูลใหม่หลังจากแก้ไขสำเร็จ
      await loadData();
    } catch (e) {
      console.error("Supabase update failed:", e);
      throw e; // โยน error กลับไปให้ EditBillView จัดการต่อใน catch block
    }
  }, [loadData]);

  useEffect(() => {
    if (userId) loadAll();
  }, [loadAll, userId]);

  // 🔔 Realtime: อัปเดต state จาก payload โดยตรง (เดิมทุก event เรียก loadData() ดึงทุกตารางใหม่ —
  // บิล 1 ใบที่มี 5 รายการ = 6 events = ดึงข้อมูลซ้ำ 6 รอบ ต่อทุกเครื่องที่เปิดอยู่)
  useEffect(() => {
    if (!userId) return;

    const patch = (setter, { eventType, new: row, old }, opts = {}) => {
      if (eventType === "DELETE") {
        const id = old?.id;
        if (id !== undefined) setter((prev) => prev.filter((x) => !sameId(x.id, id)));
        return;
      }
      if (!row || row.id === undefined) return;
      setter((prev) => {
        // บิลที่เก่ากว่าช่วงที่โหลดไว้และยังไม่อยู่ใน state → ไม่ต้องเอาเข้ามา
        if (opts.isBill && eventType === "UPDATE") {
          const exists = prev.some((x) => sameId(x.id, row.id));
          const from = billsFromRef.current;
          if (!exists && from && new Date(row.date) < from) return prev;
        }
        const next = upsertRow(prev, row);
        return opts.isBill ? sortBillsDesc(next) : next;
      });
    };

    let wasDown = false;
    const channel = supabase
      .channel("db-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "bills" },
        (p) => patch(setBills, p, { isBill: true }))
      .on("postgres_changes", { event: "*", schema: "public", table: "products" },
        (p) => patch(setProducts, p))
      .on("postgres_changes", { event: "*", schema: "public", table: "promotions" },
        (p) => patch(setPromotions, p))
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          // หลุดแล้วกลับมา → sync ครั้งเดียวเพื่อไม่ให้พลาด event ระหว่างที่หลุด
          if (wasDown) { wasDown = false; loadData(); }
        } else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
          wasDown = true;
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, loadData]);

  // กลับมาเปิดแท็บหลังพักนานเกิน 5 นาที → sync แบบเบา 1 ครั้ง (เผื่อ realtime หลุดตอนแท็บหลับ)
  useEffect(() => {
    if (!userId) return;
    let hiddenAt = null;
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
      } else {
        if (hiddenAt && Date.now() - hiddenAt > 5 * 60 * 1000) loadData();
        hiddenAt = null;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [userId, loadData]);

  const openPasswordModal = (onSuccess) => {
    setPasswordOnSuccess(() => onSuccess);
    setPasswordInput("");
    setPasswordError("");
    setShowPasswordModal(true);
  };

  // ฟังก์ชันนี้จะจัดการสลับค่า พร้อมถามรหัสผ่าน
  const requestPasswordAndToggle = () => {
    if (!sensitiveVisible) {
      openPasswordModal(() => setSensitiveVisible(true));
    } else {
      setSensitiveVisible(false);
    }
  };

  // ---- Auth gate: เช็คก่อนทุกอย่าง ----
  if (authLoading) return <LoadingSpinner />;
  if (!session) return <Login />;
  if (!isDbReady) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

      <div className="flex-1 lg:pl-64">
        <main className="p-4">
          <Routes>
            <Route
              path="/"
              element={
                <POSView
                  products={products}
                  bills={bills}
                  promotions={promotions}
                  loadData={loadData}
                  ensureBillsFrom={ensureBillsFrom}
                  setPopupContent={setPopupContent}
                  setShowPopup={setShowPopup}
                  sensitiveVisible={sensitiveVisible}
                  openPasswordModal={openPasswordModal}
                  onToggleSensitive={requestPasswordAndToggle}
                  navigateTo={handleNavigate}
                  setSidebarOpen={setIsSidebarOpen}
                />
              }
            />
            <Route
              path="/addBill"
              element={
                <AddBillView
                  products={products}
                  promotions={promotions}
                  loadData={loadData}
                  setPopupContent={setPopupContent}
                  setShowPopup={setShowPopup}
                  navigateTo={handleNavigate}
                  setSidebarOpen={setIsSidebarOpen}
                />
              }
            />
            <Route
              path="/billHistory"
              element={
                <BillHistoryView
                  bills={bills}
                  products={products}
                  loadData={loadData}
                  ensureBillsFrom={ensureBillsFrom}
                  setPopupContent={setPopupContent}
                  setShowPopup={setShowPopup}
                  setSidebarOpen={setIsSidebarOpen}
                  showBillDetails={(id) => {
                    setCurrentBillId(id);
                    navigate(`/bill-detail?id=${id}`);
                  }}
                />
              }
            />
            <Route
              path="/promotion"
              element={
                <PromotionView
                  products={products}
                  promotions={promotions}
                  reloadPromotions={reloadPromotions}
                  setPopupContent={setPopupContent}
                  setShowPopup={setShowPopup}
                  setSidebarOpen={setIsSidebarOpen}
                />
              }
            />
            <Route
                path="/dashboard"
                element={
                  <OverviewDashboard
                    bills={bills}
                    formatCurrency={formatCurrency}
                    openPasswordModal={openPasswordModal}
                    setSidebarOpen={setIsSidebarOpen}
                  />
                }
              />
            <Route
              path="/inventory"
              element={
                <ProductManagerView
                  products={products}
                  loadData={loadData}
                  setPopupContent={setPopupContent}
                  openPasswordModal={openPasswordModal}
                  setShowPopup={setShowPopup}
                  setSidebarOpen={setIsSidebarOpen}
                />
              }
            />
            <Route
              path="/bill-detail"
              element={
                <BillDetailView
                  currentBillId={currentBillId}
                  bills={bills}
                  products={products}
                  navigateTo={handleNavigate}
                  setCurrentBillId={setCurrentBillId}
                  openPasswordModal={openPasswordModal}
                  setShowPopup={setShowPopup}
                  sensitiveVisible={sensitiveVisible}
                  onToggleSensitive={() => setSensitiveVisible(!sensitiveVisible)}
                  setSidebarOpen={setIsSidebarOpen}  
                />
              }
            />
            <Route
              path="/edit-bill/:id"
              element={
                <EditBillView
                  currentBillId={currentBillId}
                  bills={bills}
                  products={products}
                  promotions={promotions}
                  loadData={loadData}
                  putData={putData} // ตรวจสอบว่าคุณมีฟังก์ชันนี้ส่งเข้ามา
                  navigateTo={handleNavigate}
                  setShowPopup={setShowPopup}
                  setPopupContent={setPopupContent}
                  setSidebarOpen={setIsSidebarOpen}
                />
              }
            />
          </Routes>
        </main>
      </div>

      {showPasswordModal && (
        <PasswordConfirmModal
          isOpen={showPasswordModal}
          onClose={() => setShowPasswordModal(false)}
          onSuccess={passwordOnSuccess}
          passwordInput={passwordInput}
          setPasswordInput={setPasswordInput}
          passwordVisible={passwordVisible}
          setPasswordVisible={setPasswordVisible}
          passwordError={passwordError}
          setPasswordError={setPasswordError}
          SENSITIVE_PASSWORD={SENSITIVE_PASSWORD}
        />
      )}
      {showPopup && (
        <Popup content={popupContent} setShowPopup={setShowPopup} />
      )}
    </div>
  );
};

export default App;
