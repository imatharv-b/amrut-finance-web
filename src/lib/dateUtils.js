export const formatDate = (dateString) => {
  if (!dateString) return '';
  const datePart = dateString.split('T')[0];
  const parts = datePart.split('-');
  if (parts.length !== 3) return dateString;
  const [year, month, day] = parts;
  return `${day}-${month}-${year}`;
};
