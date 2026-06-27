import { supabase } from './supabaseClient'; // ตรวจสอบ path ให้ตรงกับตำแหน่งไฟล์ supabaseClient ของคุณ

export const putData = async (tableName, data) => {
  try {
    const { data: result, error } = await supabase
      .from(tableName)
      .upsert(data)
      .select()
      .single();

    if (error) throw error;
    return result.id;
  } catch (error) {
    console.error(`Error in putData (${tableName}):`, error);
    throw error;
  }
};

export const deleteData = async (tableName, id) => {
  try {
    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error(`Error in deleteData (${tableName}):`, error);
    throw error;
  }
};