catch (err) {
  console.error("========== REGISTER ERROR ==========");
  console.error(err);

  if (err.errors) {
    console.error("AggregateError details:");
    err.errors.forEach((e, i) => {
      console.error(`Error ${i + 1}:`, e);
    });
  }

  console.error("====================================");

  return response.error(
    res,
    err.message || String(err),
    400
  );
}