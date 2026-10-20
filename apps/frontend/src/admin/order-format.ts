export const formatOrderDate = (date: string) =>
  new Date(date).toLocaleString('uk-UA', {
    timeZone: 'Europe/Kyiv',
    dateStyle: 'short',
    timeStyle: 'short',
  });
