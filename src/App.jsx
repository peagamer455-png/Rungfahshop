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

const App = () => {
  const [products, setProducts] = useState([]);
  const [bills, setBills] = useState([]);
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
  const SENSITIVE_PASSWORD = "261250";

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

      setProducts(productsData || []);
      setBills(billsData || []);
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
    loadData();
  }, [loadData]);

  useEffect(() => {
    const channel = supabase
      .channel('bills-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bills' },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  useEffect(() => {
    const channel = supabase
      .channel('db-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bills' },
        () => loadData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        () => loadData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

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

  if (!isDbReady) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

      <div className="flex-1 lg:pl-64">
        {/* ส่งค่า sensitiveVisible และฟังก์ชัน requestPasswordAndToggle เข้าไป */}

        <main className="p-4">
          <Routes>
            <Route
              path="/"
              element={
                <POSView
                  products={products}
                  bills={bills}
                  loadData={loadData}
                  setPopupContent={setPopupContent}
                  setShowPopup={setShowPopup}
                  sensitiveVisible={sensitiveVisible}
                  openPasswordModal={openPasswordModal}
                  onToggleSensitive={requestPasswordAndToggle}
                  navigateTo={handleNavigate}
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
                  putData={putData} // ตรวจสอบว่าคุณมีฟังก์ชันนี้ส่งเข้ามา
                  navigateTo={handleNavigate}
                  setShowPopup={setShowPopup}
                  setPopupContent={setPopupContent}
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
