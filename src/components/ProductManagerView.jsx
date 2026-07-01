import React, { useState, useMemo, useRef, useEffect } from "react";
import { Header } from "./SharedUI";
import { supabase } from "../supabaseClient";
import { formatCurrency, translateBarcode } from "../utils";
import ProductForm from "./ProductForm";
import Pagination from "./Pagination";
import { useSearchParams } from "react-router-dom";

const ProductManagerView = ({
  products,
  loadData,
  openPasswordModal,
  setPopupContent,
  setShowPopup,
  setSidebarOpen
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [currentProduct, setCurrentProduct] = useState({
    id: null,
    name: "",
    price: "",
    cost: "",
    barcode: "",
    stock: 0,
    location: "",
  });
  const [filterText, setFilterText] = useState("");
  const [importProgress, setImportProgress] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const currentPage = parseInt(searchParams.get("page") || "1");
  const [showCost, setShowCost] = useState(false);
  const [sensitiveVisible, setSensitiveVisible] = useState(false);
  const barcodeBufferRef = useRef("");
  const lastKeyTimeRef = useRef(0);
  const itemsPerPage = 25;

  const setCurrentPage = (page) => {
    setSearchParams({ page: page.toString() });
    window.scrollTo(0, 0);
  };

  const handleToggleSensitive = () => {
    if (!sensitiveVisible) {
      openPasswordModal(() => {
        setSensitiveVisible(true);
      });
    } else {
      setSensitiveVisible(false);
    }
  };

  const handlePageChange = (page) => {
    setSearchParams({ page: page.toString() });
    window.scrollTo(0, 0);
  };

  // ฟังก์ชันช่วยเหลือ (ถ้าไม่มีใน utils ให้ใช้ตัวนี้)
  const displayMaybeMasked = (val, isMoney) =>
    isMoney ? formatCurrency(val) : val;

  const filteredProducts = useMemo(() => {
    const normalizedFilter = filterText.toLowerCase().replace(/\s+/g, "");

    return products.filter((p) => {
      const normalizedName = (p.name || "").toLowerCase().replace(/\s+/g, "");
      return normalizedName.includes(normalizedFilter);
    });
  }, [products, filterText]);

  const currentProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  // --- Export CSV ---
  const exportProductsCSV = () => {
    if (!products || products.length === 0) {
      setPopupContent({
        title: "⚠️ ไม่พบข้อมูล",
        message: "ขณะนี้ยังไม่มีสินค้าสำหรับส่งออกข้อมูลครับ",
        color: "orange"
      });
      setShowPopup(true);
      return;
    }

    const BOM = "\uFEFF";
    const header = [
      "ID",
      "ชื่อสินค้า",
      "ราคาขาย",
      "ราคาทุน",
      "กำไรต่อชิ้น",
      "สต็อก",
      "รหัสบาร์โค้ด",
      "ตำแหน่ง",
    ];

    const rows = products.map((p) => {
      const price = Number(p.price) || 0;
      const cost = Number(p.cost) || 0;
      const profit = price - cost;

      return [
        String(p.id || ""),
        String(p.name || "").replace(/"/g, '""'),
        price.toFixed(2),
        cost.toFixed(2),
        profit.toFixed(2),
        Number(p.stock) || 0,
        String(p.barcode || "").replace(/"/g, '""'),
        String(p.location || "").replace(/"/g, '""'),
      ];
    });

    const csvContent = [
      header.join(","),
      ...rows.map((r) => r.map((v) => `"${v}"`).join(",")),
    ].join("\r\n");

    const blob = new Blob([BOM + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `products_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    setPopupContent({
      title: "✅ ส่งออกข้อมูลสำเร็จ",
      message: `ระบบได้ส่งออกข้อมูลจำนวน ${products.length} รายการเรียบร้อยแล้วครับ ✉️`,
      color: "green"
    });
    setShowPopup(true);
  };

  // --- Helper: Parse CSV ---
  const parseCSV = (text) => {
    const lines = [];
    let cur = "";
    let inQuotes = false;
    let row = [];
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const nxt = text[i + 1];
      if (ch === '"') {
        if (inQuotes && nxt === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (ch === "," && !inQuotes) {
        row.push(cur);
        cur = "";
        continue;
      }
      if ((ch === "\n" || ch === "\r") && !inQuotes) {
        if (cur !== "" || row.length > 0) {
          row.push(cur);
          lines.push(row);
          row = [];
          cur = "";
        }
        if (ch === "\r" && nxt === "\n") i++;
        continue;
      }
      cur += ch;
    }
    if (cur !== "" || row.length > 0) {
      row.push(cur);
      lines.push(row);
    }
    return lines;
  };

  // --- Import CSV ---
  const handleImportFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length <= 1) {
      setPopupContent({
        title: "⚠️ ไม่พบข้อมูลในไฟล์",
        message: "ไฟล์ CSV ที่เลือกไม่มีข้อมูล หรือรูปแบบไฟล์ไม่ถูกต้องครับ",
        color: "orange"
      });
      setShowPopup(true);
      return;
    }

    const headerRow = rows[0].map((h) => h.trim().toLowerCase());
    const idx = {
      id: headerRow.findIndex((h) => h.includes("id")),
      name: headerRow.findIndex(
        (h) => h.includes("name") || h.includes("ชื่อ"),
      ),
      price: headerRow.findIndex(
        (h) => h.includes("price") || h.includes("ราคา"),
      ),
      cost: headerRow.findIndex((h) => h.includes("cost") || h.includes("ทุน")),
      stock: headerRow.findIndex(
        (h) => h.includes("stock") || h.includes("สต็อก"),
      ),
      barcode: headerRow.findIndex(
        (h) => h.includes("barcode") || h.includes("บาร์โค้ด"),
      ),
      location: headerRow.findIndex(
        (h) => h.includes("location") || h.includes("ตำแหน่ง"),
      ),
    };

    let importedCount = 0;
    const totalRows = rows.length - 1;

    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i];
      if (cols.length < 2) continue;

      const name = idx.name >= 0 ? cols[idx.name]?.trim() : "";
      if (!name) continue;

      const rawId =
        idx.id >= 0 ? cols[idx.id]?.replace(/[^0-9]/g, "").trim() : null;

      const payload = {
        name,
        price: parseFloat(cols[idx.price]?.replace(/[^0-9.]/g, "")) || 0,
        cost: parseFloat(cols[idx.cost]?.replace(/[^0-9.]/g, "")) || 0,
        stock: parseInt(cols[idx.stock]) || 0,
        barcode: idx.barcode >= 0 ? cols[idx.barcode]?.trim() : null,
        location: idx.location >= 0 ? cols[idx.location]?.trim() : null,
      };

      if (rawId) payload.id = parseInt(rawId);

      // ทำการ Upsert ครั้งเดียวและเช็ค error ครั้งเดียว
      const { data, error } = await supabase
        .from("products")
        .upsert(payload, { onConflict: "id" })
        .select();

      if (!error) {
        importedCount++;
      } else {
        console.error("Import error at row", i, error);
      }

      setImportProgress(Math.round((i / totalRows) * 100));
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // โหลดข้อมูลใหม่ทั้งหมดหลังจากจบ Loop
    await loadData();

    setImportProgress(0);
    e.target.value = "";
    setPopupContent({
      title: "✅ นำเข้าข้อมูลสำเร็จ",
      message: `ระบบได้นำเข้าข้อมูลจำนวน ${importedCount} รายการเรียบร้อยแล้วครับ 💾`,
      color: "green"
    });
    setShowPopup(true);
  };

  const [isSaving, setIsSaving] = useState(false); // เพิ่ม State นี้ไว้ที่ด้านบนของ Component

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!currentProduct.name) {
      setPopupContent({
        title: "❌ ข้อมูลไม่ครบถ้วน",
        message: "กรุณาระบุชื่อสินค้าให้เรียบร้อยก่อนทำการบันทึกครับ",
        color: "red"
      });
      setShowPopup(true);
      return;
    }

    setIsSaving(true);

    const payload = {
      name: currentProduct.name,
      price: parseFloat(currentProduct.price) || 0,
      cost: parseFloat(currentProduct.cost) || 0,
      stock: parseInt(currentProduct.stock) || 0,
      barcode: currentProduct.barcode || null,
      location: currentProduct.location || null,
    };

    try {
      if (currentProduct.id) {
        const { error } = await supabase
          .from("products")
          .update(payload)
          .eq("id", currentProduct.id);
        if (error) throw error;
      } else {
        const { data: maxData } = await supabase
          .from("products")
          .select("id")
          .order("id", { ascending: false })
          .limit(1)
          .single();
        const nextId = (maxData?.id ?? 0) + 1;
        
        const { error } = await supabase.from("products").insert([{ ...payload, id: nextId }]);
        if (error) throw error;
      }

      await loadData();
      setIsEditing(false);
      setPopupContent({
        title: "✅ บันทึกข้อมูลสำเร็จ",
        message: "ระบบได้ทำการบันทึกข้อมูลของคุณเรียบร้อยแล้วครับ 💾",
        color: "green"
      });
      setShowPopup(true);
    } catch (error) {
      console.error("Save Error:", error);
      setPopupContent({
        title: "🚫 พบข้อผิดพลาด",
        message: `ขออภัยครับ ไม่สามารถดำเนินการได้: ${error.message}`,
        color: "red"
      });
      setShowPopup(true);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id, name) => {
    setPopupContent({
      title: "⚠️ ยืนยันการลบ",
      message: `คุณต้องการลบสินค้า "${name}" ใช่หรือไม่?`,
      actions: [
        {
          label: "ยกเลิก",
          variant: "secondary", // สีเทา
          handler: () => setShowPopup(false), // ปิด popup
        },
        {
          label: "ลบสินค้า",
          variant: "danger", // สีแดง
          handler: async () => {
            await supabase.from("products").delete().eq("id", id);
            await loadData();
            setShowPopup(false); // ปิด popup หลังลบเสร็จ
          },
        },
      ],
    });
    setShowPopup(true);
  };

  useEffect(() => {
    const handleScanner = (e) => {
      const activeEl = document.activeElement;
      const activeTag = activeEl?.tagName;
      const isBarcodeInput = activeEl?.dataset?.barcode === "true";

      if ((activeTag === "INPUT" || activeTag === "TEXTAREA") && !isBarcodeInput) return;

      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;

      if (timeDiff > 300) barcodeBufferRef.current = "";
      lastKeyTimeRef.current = now;

      if (e.key === "Enter") {
        const raw = barcodeBufferRef.current;
        if (raw.length > 2) {
          const hasThaiChars = /[\u0E00-\u0E7F]/.test(raw);
          const result = hasThaiChars ? translateBarcode(raw) : raw;
          setCurrentProduct(prev => ({ ...prev, barcode: result }));
        }
        barcodeBufferRef.current = "";
        e.preventDefault();
      } else if (e.key.length === 1) {
        if (isBarcodeInput) e.preventDefault();
        barcodeBufferRef.current += e.key;
      }
    };

    window.addEventListener("keypress", handleScanner);
    return () => window.removeEventListener("keypress", handleScanner);
  }, []); // ← เปลี่ยนเป็น [] เพราะใช้ setCurrentProduct แบบ functional update (prev =>) แล้วไม่ต้องการ closure ของ state

  if (isEditing) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <Header
          title={currentProduct.id ? "✏️ แก้ไขสินค้า" : "➕ เพิ่มสินค้าใหม่"}
          sensitiveVisible={sensitiveVisible}
          onToggleSensitive={handleToggleSensitive}
          onToggleSidebar={() => setSidebarOpen(prev => !prev)}
        />
        {importProgress > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl">
              <h3 className="text-lg font-bold mb-2">
                กำลังนำเข้าข้อมูล... {importProgress}%
              </h3>
              <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                <div
                  className="bg-green-500 h-full transition-all duration-300 ease-linear"
                  style={{ width: `${importProgress}%` }}
                />
              </div>
              <p className="text-sm text-gray-500 mt-2">
                กรุณารอจนกว่าแถบสถานะจะเต็ม
              </p>
            </div>
          </div>
        )}
        <div className="max-w-xl mx-auto mt-6 p-6 bg-white rounded-xl shadow-lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* ชื่อสินค้า */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                ชื่อสินค้า
              </label>
              <input
                type="text"
                value={currentProduct.name}
                onChange={(e) =>
                  setCurrentProduct({ ...currentProduct, name: e.target.value })
                }
                className="w-full p-3 border rounded-lg"
                required
              />
            </div>

            {/* ราคาขาย / ราคาทุน */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  ราคาขาย
                </label>
                <input
                  type="number"
                  value={currentProduct.price}
                  onChange={(e) =>
                    setCurrentProduct({
                      ...currentProduct,
                      price: e.target.value,
                    })
                  }
                  className="w-full p-3 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  ราคาทุน
                </label>
                <input
                  type="number"
                  value={currentProduct.cost}
                  onChange={(e) =>
                    setCurrentProduct({
                      ...currentProduct,
                      cost: e.target.value,
                    })
                  }
                  className="w-full p-3 border rounded-lg"
                  required
                />
              </div>
            </div>

            {/* สต็อก */}
            <div>
              <label className="block text-sm font-bold text-gray-600">
                📦 สต็อก
              </label>
              <input
                type="number"
                value={currentProduct.stock}
                onChange={(e) =>
                  setCurrentProduct({
                    ...currentProduct,
                    stock: e.target.value,
                  })
                }
                className="w-full p-3 border-2 border-blue-200 rounded-lg"
              />
            </div>

            {/* [เพิ่มใหม่] ตำแหน่งที่เก็บสินค้า */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                ที่เก็บสินค้า (ชั้น/โซน)
              </label>
              <input
                type="text"
                value={currentProduct.location || ""}
                onChange={(e) =>
                  setCurrentProduct({
                    ...currentProduct,
                    location: e.target.value,
                  })
                }
                className="w-full p-3 border rounded-lg"
                placeholder="เช่น ชั้น A1, โซนหลังร้าน"
              />
            </div>

            {/* [เพิ่มใหม่] บาร์โค้ด */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                รหัสบาร์โค้ด
              </label>
              <input
                type="text"
                data-barcode="true"
                value={currentProduct.barcode || ""}
                onChange={(e) =>
                  setCurrentProduct({ ...currentProduct, barcode: e.target.value })
                }
                className="w-full p-3 border rounded-lg"
                placeholder="แสกนหรือพิมพ์บาร์โค้ด"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-6 py-2 bg-gray-200 rounded-lg"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className={`px-6 py-2 rounded-lg font-semibold text-white transition ${isSaving ? "bg-gray-400 cursor-not-allowed" : "bg-green-500 hover:bg-green-600"}`}
              >
                {isSaving ? "กำลังบันทึก..." : "บันทึกสินค้า"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <Header
        title="📦 จัดการสินค้า"
        sensitiveVisible={sensitiveVisible}
        onToggleSensitive={handleToggleSensitive}
        onToggleSidebar={() => setSidebarOpen(prev => !prev)}
      />
      {importProgress > 0 && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center">
            <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <h3 className="text-xl font-bold text-gray-800">
              กำลังนำเข้า... {importProgress}%
            </h3>
            <p className="text-gray-500">กรุณารอระบบอัปเดตข้อมูล</p>
          </div>
        </div>
      )}
      <div className="mt-6 flex flex-col sm:flex-row justify-between items-center mb-4 gap-3">
        <input
          type="text"
          placeholder="🔍 ค้นหาสินค้า..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="w-full sm:w-80 p-3 border rounded-lg shadow-sm"
        />
        <div className="flex items-center gap-2">
          {/* ปุ่ม Export */}
          <button
            onClick={exportProductsCSV}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg font-bold shadow-md transition-all duration-200 hover:bg-blue-600 hover:scale-105 active:scale-95"
          >
            Export CSV
          </button>

          {/* ปุ่ม Import */}
          <label className="px-4 py-2 bg-purple-500 text-white rounded-lg font-bold shadow-md cursor-pointer transition-all duration-200 hover:bg-purple-600 hover:scale-105 active:scale-95">
            Import CSV
            <input
              type="file"
              accept=".csv"
              onChange={handleImportFile}
              className="hidden"
            />
          </label>

          {/* ปุ่มเพิ่มสินค้าใหม่ */}
          <button
            onClick={() => {
              setCurrentProduct({
                id: null,
                name: "",
                price: "",
                cost: "",
                barcode: "",
                stock: 0,
                location: "",
              });
              setIsEditing(true);
            }}
            className="px-4 py-2 bg-green-500 text-white rounded-lg font-bold shadow-md transition-all duration-200 hover:bg-green-600 hover:scale-105 active:scale-95"
          >
            + เพิ่มสินค้าใหม่
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg overflow-x-auto border border-gray-100">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-green-50">
            <tr>
              <th className="px-6 py-3 text-left text-m font-bold text-green-700 uppercase">
                ชื่อสินค้า
              </th>
              <th className="px-6 py-3 text-left text-m font-bold text-blue-600 uppercase">
                สต็อก
              </th>
              <th className="px-6 py-3 text-left text-m font-bold text-green-700 uppercase">
                ราคาขาย
              </th>
              <th className="px-6 py-3 text-left text-m font-bold text-red-700 uppercase">
                ราคาต้นทุน
              </th>
              <th className="px-6 py-3 text-left text-m font-bold text-green-600 uppercase">
                กำไรต่อชิ้น
              </th>
              <th className="px-6 py-3 text-right text-m font-bold text-green-700 uppercase">
                จัดการ
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {currentProducts.map((product) => (
              <tr key={product.id} className="hover:bg-green-50">
                <td className="px-6 py-4 text-l font-">{product.name}</td>
                <td className="px-6 py-4 text-xl font-bold text-blue-600">
                  {product.stock}
                </td>
                <td className="px-6 py-4 text-l font-bold text-green-700">
                  {formatCurrency(product.price)}
                </td>
                <td className="px-6 py-4 text-l font-bold text-red-600">
                  {sensitiveVisible ? formatCurrency(product.cost) : "****"}
                </td>
                <td className="px-6 py-4 text-l font-bold text-green-600">
                  {sensitiveVisible
                    ? formatCurrency(product.price - product.cost)
                    : "****"}
                </td>
                <td className="px-6 py-4 text-right space-x-2">
                  <button
                    onClick={() => {
                      setCurrentProduct(product);
                      setIsEditing(true);
                    }}
                    className="text-green-600 hover:text-green-800 p-2 rounded-full hover:bg-green-100 transition duration-150"
                    title="แก้ไขสินค้า"
                    aria-label="Edit"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-7-7l-4 4-2 2v2h2l2-2 4-4m-7-7l4-4 2 2"
                      />
                    </svg>
                  </button>

                  {/* ปุ่มลบ */}
                  <button
                    onClick={() => handleDelete(product.id, product.name)}
                    className="text-red-600 hover:text-red-800 p-2 rounded-full hover:bg-red-100 transition duration-150"
                    title="ลบสินค้า"
                    aria-label="Delete"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4">
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          setCurrentPage={handlePageChange}
        />
      </div>
    </div>
  );
};

export default ProductManagerView;
