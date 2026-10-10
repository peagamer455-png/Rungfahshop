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

const App = () => {
  const { session, loading: authLoading } = useAuth();
  const userId = session?.user?.id; // ใช้ userId แทน session เพราะ object session เปลี่ยนทุกครั้งที่ token refresh

  const [products, setProducts] = useState([]);
  const [bills, setBills] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [sensitiveVisible, setSensitiveVisible] = useState(false);
  const [isDbReady, setIsDbReady] = useState(false);
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const handleNavigate = (path) => {
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
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
  const SENSITIVE_PASSWORD = "******"; // ⚠️ ใส่รหัสจริงกลับเข้าไป

  // ใช้นับรอบการโหลด ถ้ามีหลายรอบซ้อนกัน จะใช้ผลของรอบล่าสุดเท่านั้น
  const loadSeqRef = useRef(0);

  // silent = true: ถ้าโหลดพลาดจะไม่เด้ง popup (ใช้ตอนโหลดเบื้องหลัง)
  const loadData = useCallback(async ({ silent = false } = {}) => {
    const seq = ++loadSeqRef.current;
    try {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      // โหลด 3 ตารางพร้อมกัน จะเร็วกว่าโหลดทีละตาราง
      const [pRes, bRes, promoRes] = await Promise.all([
        supabase.from("products").select("*"),
        supabase
          .from("bills")
          .select("*")
          .gte("date", threeMonthsAgo.toISOString())
          .order("date", { ascending: false }),
        supabase.from("promotions").select("*"),
      ]);

      if (pRes.error) throw pRes.error;
      if (bRes.error) throw bRes.error;
      if (promoRes.error) throw promoRes.error;

      // ถ้ามีรอบใหม่กว่าเริ่มไปแล้ว ไม่ต้องเอาผลรอบนี้ไปทับ
      if (seq !== loadSeqRef.current) return;

      setProducts(pRes.data || []);
      setBills(bRes.data || []);
      setPromotions(promoRes.data || []);
    } catch (e) {
      console.error("Supabase load failed:", e);
      if (!silent) {
        setPopupContent({
          title: "🚫 พบปัญหาการเชื่อมต่อ",
          message:
            "ไม่สามารถเชื่อมต่อฐานข้อมูลได้ในขณะนี้ โปรดตรวจสอบการเชื่อมต่ออินเทอร์เน็ตของท่านแล้วลองใหม่อีกครั้งครับ",
          color: "red",
        });
        setShowPopup(true);
      }
    } finally {
      setIsDbReady(true);
    }
  }, []);

  const putData = useCallback(
    async (table, data) => {
      try {
        const { error } = await supabase.from(table).upsert(data);
        if (error) throw error;
        await loadData();
      } catch (e) {
        console.error("Supabase update failed:", e);
        throw e;
      }
    },
    [loadData]
  );

  // โหลดข้อมูลครั้งแรกหลังล็อกอิน
  useEffect(() => {
    if (userId) loadData();
  }, [loadData, userId]);

  // Realtime + ระบบสำรองกันข้อมูลไม่ตรงกัน
  useEffect(() => {
    if (!userId) return;

    // รวม event ที่เข้ามาติด ๆ กัน (เช่นตอน import CSV) ให้เหลือการโหลดครั้งเดียว
    let debounceTimer;
    const reload = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => loadData({ silent: true }), 300);
    };

    const channel = supabase
      .channel(`db-realtime-${Date.now()}`) // ชื่อไม่ซ้ำ จะได้ไม่ชนกับช่องเก่าที่ยังปิดไม่เสร็จ
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, (p) => {
        console.log("[RT] products", p.eventType);
        reload();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "bills" }, (p) => {
        console.log("[RT] bills", p.eventType);
        reload();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "promotions" }, (p) => {
        console.log("[RT] promotions", p.eventType);
        reload();
      })
      .subscribe((status, err) => {
        console.log("[RT] status:", status, err || "");
        // ต่อติด/ต่อกลับมาได้แล้วให้โหลดใหม่ เผื่อพลาด event ช่วงที่หลุด
        if (status === "SUBSCRIBED") reload();
      });

    // กลับมาที่แท็บหรือเปิดจอ ให้โหลดใหม่ทันที
    const onVisible = () => {
      if (document.visibilityState === "visible") reload();
    };
    const onOnline = () => reload();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);

    // ระบบสำรองชั้นสุดท้าย: โหลดใหม่ทุก 20 วินาทีระหว่างที่เปิดหน้าจออยู่
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") loadData({ silent: true });
    }, 20000);

    return () => {
      clearTimeout(debounceTimer);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      supabase.removeChannel(channel);
    };
  }, [loadData, userId]);

  const openPasswordModal = (onSuccess) => {
    setPasswordOnSuccess(() => onSuccess);
    setPasswordInput("");
    setPasswordError("");
    setShowPasswordModal(true);
  };

  const requestPasswordAndToggle = () => {
    if (!sensitiveVisible) {
      openPasswordModal(() => setSensitiveVisible(true));
    } else {
      setSensitiveVisible(false);
    }
  };

  // ---- Auth gate ----
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
                  loadData={loadData}
                  putData={putData}
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
      {showPopup && <Popup content={popupContent} setShowPopup={setShowPopup} />}
    </div>
  );
};

export default App;
