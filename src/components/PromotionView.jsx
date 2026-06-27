import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const PromotionView = ({ products, setPopupContent, setShowPopup }) => {
  const [promotions, setPromotions] = useState([]);
  const [formData, setFormData] = useState({
    name: '', type: 'qty', items: [], minQty: 1, discountPrice: ''
  });
  const [searchTerm, setSearchTerm] = useState('');

  const fetchPromotions = async () => {
    const { data, error } = await supabase
      .from('promotions')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error("Error fetching from Supabase:", error);
      setPromotions([]);
    } else {
      setPromotions(data || []);
    }
  };

  useEffect(() => { fetchPromotions(); }, []);

  const showAppPopup = (title, message) => {
    setPopupContent({ title, message });
    setShowPopup(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.discountPrice || formData.items.length === 0) {
      showAppPopup('⚠️ ข้อมูลไม่ครบ', 'กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    const promoToSave = {
      name: formData.name,
      type: formData.type,
      items: formData.items,
      min_qty: formData.type === 'qty' ? formData.minQty : null,
      discount_price: Number(formData.discountPrice),
      created_at: new Date().toISOString()
    };

    // 2. บันทึกลง Supabase
    const { data, error } = await supabase
      .from('promotions')
      .insert([promoToSave]);

    if (error) {
      console.error("Error saving to Supabase:", error);
      showAppPopup('❌ ผิดพลาด', 'ไม่สามารถบันทึกข้อมูลได้: ' + error.message);
      return;
    }

    setFormData({ name: '', type: 'qty', items: [], minQty: 1, discountPrice: '' });
    fetchPromotions();
    showAppPopup('✅ สำเร็จ', 'บันทึกโปรโมชั่นใหม่เรียบร้อยแล้ว');
  };

  const deletePromo = async (id) => {
    const performDelete = async () => {
      const { error } = await supabase
        .from('promotions') // ชื่อตาราง
        .delete()
        .eq('id', id); // ระบุเงื่อนไขว่าต้องลบตัวที่มี id ตรงกับที่ส่งมา

      if (error) {
        console.error("Error deleting:", error);
        showAppPopup('❌ ผิดพลาด', 'ไม่สามารถลบโปรโมชั่นได้');
      } else {
        setShowPopup(false);
        fetchPromotions(); // ดึงรายการใหม่หลังจากลบสำเร็จ
      }
    };

    setPopupContent({
      title: "⚠️ ยืนยันการลบโปรโมชั่น",
      message: "คุณต้องการลบโปรโมชั่นนี้ใช่หรือไม่? ข้อมูลโปรโมชั่นนี้จะถูกลบออกจากระบบอย่างถาวรครับ",
      color: "red",
      actions: [
        {
          label: 'ยกเลิก',
          handler: () => setShowPopup(false),
          onClick: () => setShowPopup(false),
          variant: 'secondary'
        },
        {
          label: 'ยืนยัน',
          handler: performDelete, // เรียกใช้ฟังก์ชันที่สร้างไว้ด้านบน
          onClick: performDelete,
          variant: 'danger'
        }
      ]
    });
    setShowPopup(true);
  };

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 5);

  const renderList = () => (
    <div className="space-y-4">
      {promotions.length === 0 ? (
        <div className="text-center py-10 text-gray-400 bg-white rounded-2xl border border-dashed">ไม่มีโปรโมชั่น</div>
      ) : (
        promotions.map(promo => (
          <div key={promo.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between hover:border-green-200 transition-all">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-50 text-green-600 rounded-xl">
                {/* ไอคอนที่ต้องการ */}
                <svg className="w-6 h-6 text-green-600" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                  <path stroke="currentColor" strokeLinecap="round" strokeLinecap="round" strokeWidth="2" d="M8.891 15.107 15.11 8.89m-5.183-.52h.01m3.089 7.254h.01M14.08 3.902a2.849 2.849 0 0 0 2.176.902 2.845 2.845 0 0 1 2.94 2.94 2.849 2.849 0 0 0 .901 2.176 2.847 2.847 0 0 1 0 4.16 2.848 2.848 0 0 0-.901 2.175 2.843 2.843 0 0 1-2.94 2.94 2.848 2.848 0 0 0-2.176.902 2.847 2.847 0 0 1-4.16 0 2.85 2.85 0 0 0-2.176-.902 2.845 2.845 0 0 1-2.94-2.94 2.848 2.848 0 0 0-.901-2.176 2.848 2.848 0 0 1 0-4.16 2.849 2.849 0 0 0 .901-2.176 2.845 2.845 0 0 1 2.941-2.94 2.849 2.849 0 0 0 2.176-.901 2.847 2.847 0 0 1 4.159 0Z" />
                </svg>
              </div>
              <div>
                <h4 className="font-bold text-gray-800">{promo.name}</h4>
                <p className="text-xs text-gray-500">
                  {promo.type === 'bundle' ? 'จับคู่:' : `ซื้อ ${promo.min_qty} ชิ้น:`}
                  <span className="text-blue-600 ml-1">{promo.items.map(it => it.name).join(', ')}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <span className="font-black text-lg text-green-600">{Number(promo.discount_price).toLocaleString()} ฿</span>
              <button
                onClick={() => deletePromo(promo.id)}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
              >
                {/* ไอคอนถังขยะ SVG */}
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );

  // ส่วนแสดงฟอร์ม (ใช้ไอคอนที่ต้องการตรงหัวข้อ)
  const renderForm = () => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
      <h3 className="font-bold text-gray-800 text-lg mb-2 flex items-center gap-2">
        <svg className="w-6 h-6 text-green-600" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
          <path stroke="currentColor" strokeLinecap="round" strokeLinecap="round" strokeWidth="2" d="M8.891 15.107 15.11 8.89m-5.183-.52h.01m3.089 7.254h.01M14.08 3.902a2.849 2.849 0 0 0 2.176.902 2.845 2.845 0 0 1 2.94 2.94 2.849 2.849 0 0 0 .901 2.176 2.847 2.847 0 0 1 0 4.16 2.848 2.848 0 0 0-.901 2.175 2.843 2.843 0 0 1-2.94 2.94 2.848 2.848 0 0 0-2.176.902 2.847 2.847 0 0 1-4.16 0 2.85 2.85 0 0 0-2.176-.902 2.845 2.845 0 0 1-2.94-2.94 2.848 2.848 0 0 0-.901-2.176 2.848 2.848 0 0 1 0-4.16 2.849 2.849 0 0 0 .901-2.176 2.845 2.845 0 0 1 2.941-2.94 2.849 2.849 0 0 0 2.176-.901 2.847 2.847 0 0 1 4.159 0Z" />
        </svg>

        สร้างโปรโมชั่นใหม่
      </h3>

      <input
        className="w-full bg-gray-100 border-none p-3 rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
        placeholder="ชื่อโปรโมชั่น"
        value={formData.name}
        onChange={e => setFormData({ ...formData, name: e.target.value })}
      />

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setFormData({ ...formData, type: 'qty', items: [] })}
          className={`p-4 rounded-xl text-sm font-bold border-2 transition-all ${formData.type === 'qty'
            ? 'border-green-500 bg-green-50 text-green-700'
            : 'border-gray-300 bg-white text-gray-500 hover:border-gray-400'
            }`}
        >
          ซื้อครบจำนวน (Qty)
        </button>

        <button
          type="button"
          onClick={() => setFormData({ ...formData, type: 'bundle', items: [] })}  // ✅
          className={`p-4 rounded-xl text-sm font-bold border-2 transition-all ${formData.type === 'bundle'
              ? 'border-green-500 bg-green-50 text-green-700'
              : 'border-gray-300 bg-white text-gray-500 hover:border-gray-400'
            }`}
        >
          จับคู่สินค้า (Bundle)
        </button>
      </div>

      <div className="space-y-2 relative">
        <input
          className="w-full bg-gray-100 border-none p-3 rounded-xl"
          placeholder="ค้นหาสินค้า..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />

        {/* เพิ่มส่วนนี้เข้าไป: แสดงรายการสินค้าเมื่อมีการค้นหา */}
        {searchTerm && (
          <div className="absolute z-50 w-full bg-white border border-gray-100 rounded-2xl shadow-xl mt-2 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-4 py-2 bg-gray-50 text-xs font-bold text-gray-400 uppercase">
              ผลการค้นหา {filteredProducts.length} รายการ
            </div>

            <div className="max-h-60 overflow-y-auto">
              {filteredProducts.length > 0 ? (
                filteredProducts.map(p => (
                  <div
                    key={p.id}
                    className="px-4 py-3 hover:bg-green-50 active:bg-green-100 cursor-pointer text-sm flex items-center justify-between transition-colors border-b border-gray-50 last:border-none"
                    onClick={() => {
                      setFormData({ ...formData, items: [...formData.items, { id: p.id, name: p.name }] });
                      setSearchTerm('');
                    }}
                  >
                    <span className="font-medium text-gray-700">{p.name}</span>
                    <span className="text-green-600 text-xs font-bold">+ เพิ่ม</span>
                  </div>
                ))
              ) : (
                <div className="px-4 py-6 text-center text-gray-400 text-sm italic">
                  ไม่พบสินค้าที่ค้นหา
                </div>
              )}
            </div>
          </div>
        )}

        {/* รายการที่เลือกไว้ */}
        <div className="flex flex-wrap gap-2 mt-2">
          {formData.items.map((it, idx) => (
            <span key={idx} className="bg-green-100 text-green-700 px-3 py-1 rounded-lg text-xs font-semibold flex items-center">
              {it.name}
              <button className="ml-2 hover:text-green-900" onClick={() => setFormData({ ...formData, items: formData.items.filter((_, i) => i !== idx) })}>✕</button>
            </span>
          ))}
        </div>
      </div>

      {/* ส่วนของจำนวนขั้นต่ำ */}
      {formData.type === 'qty' && (
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 ml-1">จำนวนขั้นต่ำที่ต้องซื้อ</label>
          <div className="relative flex items-center">
            <input
              type="number"
              className="w-full bg-gray-100 border-none p-3 rounded-xl pr-16 outline-none focus:ring-2 focus:ring-green-500"
              placeholder="ระบุจำนวน"
              value={formData.minQty}
              onChange={e => setFormData({ ...formData, minQty: Number(e.target.value) })}
            />
            <span className="absolute right-4 text-sm font-bold text-gray-400">ชิ้น</span>
          </div>
        </div>
      )}

      {/* ส่วนของราคาพิเศษ */}
      <div className="space-y-1">
        <label className="text-xs font-bold text-gray-500 ml-1">ราคาที่ต้องการขาย (รวมโปรโมชั่น)</label>
        <div className="relative flex items-center">
          <input
            type="number"
            className="w-full bg-gray-100 border-none p-3 rounded-xl pr-12 outline-none focus:ring-2 focus:ring-green-500"
            placeholder="0.00"
            value={formData.discountPrice}
            onChange={e => setFormData({ ...formData, discountPrice: e.target.value })}
          />
          <span className="absolute right-4 text-sm font-bold text-gray-400">บาท</span>
        </div>
      </div>

      <button onClick={handleSave} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 transition shadow-md shadow-green-200">
        บันทึกโปรโมชั่น
      </button>
    </div>
  );

  return (
    <div className="p-4 sm:p-8 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold text-gray-800 mb-8">🎁 จัดการโปรโมชั่น</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">{renderForm()}</div>
        <div className="lg:col-span-2">{renderList()}</div>
      </div>
    </div>
  );
};

export default PromotionView;