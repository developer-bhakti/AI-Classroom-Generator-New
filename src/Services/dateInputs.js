// Helpers for <input type="date"> values ("2027-05-15") and the ISO timestamps the database stores.

export const toDateInput = (date) => {
  const d = new Date(date);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
};

/** The last moment of that day, so a subscription "until the 15th" includes the 15th. */
export const fromDateInput = (value) => new Date(`${value}T23:59:59`).toISOString();

export const addMonths = (date, months) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
};
