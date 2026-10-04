// Demo photography from Unsplash, loaded straight from their image server.
// Swap these for the villa's own photos (drop files in /public and use "/my-photo.jpg").
const u = (id: string, w = 900) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=75`;

export const PHOTOS = {
  villa: u("photo-1582610116397-edb318620f90", 1400), // Dinuka Lankaloka
  ocean: u("photo-1729606188713-814d1b7bf893"), // Antonio Araujo
  garden: u("photo-1776500587879-5f8acadf4a69"), // Tran Vinh
  pool: u("photo-1782837025675-866250932208"), // X F
};
