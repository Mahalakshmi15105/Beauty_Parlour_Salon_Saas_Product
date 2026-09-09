export const getFullImageUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
    return url;
  }
  const apiBase = import.meta.env.VITE_API_URL || "https://salon-backend.smartgonext.com/api/v1";
  const backendBase = apiBase.replace(/\/api\/v1\/?$/, "");
  return `${backendBase}${url.startsWith("/") ? "" : "/"}${url}`;
};
