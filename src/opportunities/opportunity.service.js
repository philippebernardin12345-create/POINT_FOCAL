
const getActiveEntryOpportunity = async (supabase) => {
  const { data, error } = await supabase
    .from("opportunities")
    .select("*")
    .eq("status", "active")
    .eq("is_entry", true)
    .order("priority", { ascending: true })
    .limit(1);

  if (error) {
    throw error;
  }

  return data && data.length > 0 ? data[0] : null;
};


const getAllOpportunities = async (supabase) => {
  const { data, error } = await supabase
    .from("opportunities")
    .select("*")
    .order("priority", { ascending: true });

  if (error) {
    throw error;
  }

  return data;
};


module.exports = {
  getActiveEntryOpportunity,
  getAllOpportunities
};