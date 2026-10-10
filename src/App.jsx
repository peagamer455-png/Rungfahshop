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
  const accessToken = session?.access_token;
  const hasSession = !!session;

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
  const SENSITIVE_PASSWORD = "241114";

  // true เมื่อ realtime channel อยู่ในสถานะ SUBSCRIBED (ใช้ตัดสินใจเรื่อง polling สำรอง)
  const realtimeOkRef = useRef(false);
  const reloadTimerRef = useRef(null);

  const loadData = useCallback(async () => {
    try {
      const { data: productsData, error: pErr } = await supabase
        .from("products")
        .select("*");
      if (pErr) throw pErr;

      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      const { data: billsData, error: bErr } = await supabase
        .from("bills")
        .select("*")
        .gte("date", threeMonthsAgo.toISOString())
        .order("date", { ascending: false });

      if (bErr) throw bErr;

      const { data: promotionsData, error: promoErr } = await supabase
        .from("promotions")
        .select("*");
      if (promoErr) throw promoErr;

      setProducts(productsData || []);
      setBills(billsData || []);
      setPromotions(promotionsData || []);
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

  // รวม event ที่มาถี่ๆ ให้เหลือ loadData() ครั้งเดียว (debounce 300ms)
  const scheduleReload = useCallback(() => {
    if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    reloadTimerRef.current = setTimeout(() => {
      reloadTimerRef.current = null;
      loadData();
    }, 300);
  }, [loadData]);

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
    if (hasSession) loadData();
  }, [loadData, hasSession]);

  // ---------------------------------------------------------------
  // Realtime: channel เดียว + กันหลุดเงียบ
  //  1) setAuth ด้วย access token ล่าสุดก่อน subscribe (และ re-subscribe เมื่อ token เปลี่ยน)
  //  2) ถ้า channel ขึ้น CHANNEL_ERROR / TIMED_OUT / CLOSED -> สร้างใหม่อัตโนมัติ (backoff)
  //  3) ทุกครั้งที่ SUBSCRIBED (รวมตอนต่อใหม่) -> ดึงข้อมูลล่าสุดกัน event ที่พลาดไประหว่างหลุด
  // ---------------------------------------------------------------
  useEffect(() => {
    if (!hasSession) return;

    let cancelled = false;
    let channel = null;
    let retryTimer = null;
    let retryCount = 0;
    let connectionId = 0;

    const connect = () => {
      if (cancelled) return;

      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }

      const myId = ++connectionId;

      channel = supabase
        .channel(`db-realtime-${myId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "bills" },
          (payload) => {
            console.log("[realtime] bills changed:", payload.eventType);
            scheduleReload();
          }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "products" },
          (payload) => {
            console.log("[realtime] products changed:", payload.eventType);
            scheduleReload();
          }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "promotions" },
          (payload) => {
            console.log("[realtime] promotions changed:", payload.eventType);
            scheduleReload();
          }
        )
        .subscribe((status, err) => {
          // ข้าม callback ของ channel เก่าที่ถูกแทนที่ไปแล้ว
          if (cancelled || myId !== connectionId) return;

          console.log("[realtime] status:", status, err || "");

          if (status === "SUBSCRIBED") {
            realtimeOkRef.current = true;
            retryCount = 0;
            scheduleReload(); // sync ข้อมูลล่าสุดทุกครั้งที่ต่อติด
            return;
          }

          if (
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT" ||
            status === "CLOSED"
          ) {
            realtimeOkRef.current = false;
            if (retryTimer) clearTimeout(retryTimer);
            const delay = Math.min(30000, 1000 * 2 ** retryCount);
            retryCount += 1;
            console.warn(`[realtime] reconnecting in ${delay}ms`);
            retryTimer = setTimeout(connect, delay);
          }
        });
    };

    // ให้ Realtime ใช้ token ล่าสุดของผู้ใช้
    if (accessToken) supabase.realtime.setAuth(accessToken);
    connect();

    return () => {
      cancelled = true;
      realtimeOkRef.current = false;
      if (retryTimer) clearTimeout(retryTimer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [hasSession, accessToken, scheduleReload]);

  // กันพลาด: กลับมาที่ tab / เน็ตกลับมา -> ดึงข้อมูลใหม่
  useEffect(() => {
    if (!hasSession) return;

    const onVisible = () => {
      if (document.visibilityState === "visible") scheduleReload();
    };
    const onOnline = () => scheduleReload();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [hasSession, scheduleReload]);

  // Polling สำรอง: ทำงานเฉพาะตอนที่ realtime ไม่ SUBSCRIBED (ทุก 20 วินาที)
  useEffect(() => {
    if (!hasSession) return;
    const timer = setInterval(() => {
      if (!realtimeOkRef.current && document.visibilityState === "visible") {
        console.log("[realtime] not subscribed, polling fallback");
        loadData();
      }
    }, 20000);
    return () => clearInterval(timer);
  }, [hasSession, loadData]);

  // เคลียร์ debounce timer ตอน unmount
  useEffect(() => {
    return () => {
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    };
  }, []);

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
      {showPopup && (
        <Popup content={popupContent} setShowPopup={setShowPopup} />
      )}
    </div>
  );
};

export default App;
