
const allowedTypes = [
  "native",
  "configurable"
];


const validateOpportunity = (data) => {

  if (!data.name) {
    return "Le nom est obligatoire";
  }


  if (!allowedTypes.includes(data.type)) {
    return "Type d'opportunité invalide";
  }


  if (typeof data.priority !== "number") {
    return "La priorité doit être un nombre";
  }


  return null;
};


module.exports = {
  validateOpportunity
};