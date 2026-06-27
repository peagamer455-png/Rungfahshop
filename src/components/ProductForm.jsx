import React from 'react';

const ProductForm = ({ currentProduct, setCurrentProduct, handleSubmit, setIsEditing, translateBarcode }) => {
  const handleChange = (e) => {
    const { name, value } = e.target;
    setCurrentProduct(prev => ({ 
      ...prev, 
      [name]: name === 'barcode' ? translateBarcode(value) : value 
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow max-w-xl mx-auto mt-6 space-y-4">
      <input className="w-full p-2 border rounded" name="name" value={currentProduct.name} onChange={handleChange} placeholder="ชื่อสินค้า" required />
      <div className="grid grid-cols-2 gap-4">
        <input type="number" className="p-2 border rounded" name="price" value={currentProduct.price} onChange={handleChange} placeholder="ราคาขาย" required />
        <input type="number" className="p-2 border rounded" name="cost" value={currentProduct.cost} onChange={handleChange} placeholder="ราคาทุน" required />
      </div>
      <input type="number" className="w-full p-2 border rounded" name="stock" value={currentProduct.stock} onChange={handleChange} placeholder="จำนวนสต็อก" />
      <button type="submit" className="bg-green-500 text-white px-6 py-2 rounded">บันทึกสินค้า</button>
      <button type="button" onClick={() => setIsEditing(false)} className="ml-2 bg-gray-300 px-6 py-2 rounded">ยกเลิก</button>
    </form>
  );
};
export default ProductForm;