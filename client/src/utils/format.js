export const formatCurrency = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value) || 0);

export const formatDate = (value) =>
  new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

// Date -> "YYYY-MM-DD" for <input type="date">
export const toDateInput = (value) => new Date(value).toISOString().slice(0, 10);

export const currentMonth = () => new Date().toISOString().slice(0, 7);

export const errorMessage = (err) =>
  err?.response?.data?.error || "Something went wrong. Try again.";
