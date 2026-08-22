import api from "./api";

export async function getPrices() {
  const { data } = await api.get("/admin/prices");
  return data.prices;
}

export async function replaceAllPrices(prices) {
  const { data } = await api.put("/admin/prices", prices);
  return data;
}

export async function updatePrice(materialKey, brand, price) {
  const { data } = await api.put(`/admin/prices/${materialKey}/${brand}`, {
    price,
  });
  return data;
}

export async function addBrand(materialKey, brand, price) {
  const { data } = await api.post(`/admin/prices/${materialKey}/${brand}`, {
    price,
  });
  return data;
}

export async function deleteBrand(materialKey, brand) {
  const { data } = await api.delete(`/admin/prices/${materialKey}/${brand}`);
  return data;
}
