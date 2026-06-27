import React from 'react';
import { deleteData, PRODUCT_STORE } from '../utils';

const ProductTable = ({ products, loadData, setPopupContent, setShowPopup, handleEdit, formatCurrency }) => {
  const handleDelete = (id, name) => {
    setPopupContent({
      title: "⚠️ ยืนยันการลบข้อมูล",
      message: `คุณต้องการลบ "${name}" ใช่หรือไม่? รายการนี้จะถูกลบออกจากระบบอย่างถาวรครับ`,
      color: "red",
      actions: [{ label: "ลบ", primary: true, handler: async () => { await deleteData(PRODUCT_STORE, id); await loadData(); } }]
    });
    setShowPopup(true);
  };

  return (
    <table className="w-full bg-white shadow rounded">
      <thead className="bg-gray-100"><tr><th>ชื่อ</th><th>สต็อก</th><th>ราคา</th><th>จัดการ</th></tr></thead>
      <tbody>
        {products.map(p => (
          <tr key={p.id} className="border-t">
            <td className="p-2">{p.name}</td>
            <td className={`p-2 font-bold ${p.stock <= 5 ? 'text-red-600' : 'text-blue-600'}`}>{p.stock}</td>
            <td className="p-2">{formatCurrency(p.price)}</td>
            <td className="p-2">
              <button onClick={() => handleEdit(p)} className="text-green-500 mr-2">แก้ไข</button>
              <button onClick={() => handleDelete(p.id, p.name)} className="text-red-500">ลบ</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
export default ProductTable;