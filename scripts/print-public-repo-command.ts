const command =
  "gh repo edit eklavyagoyal/recall-h0 --description 'Recall traces a foodborne outbreak to every affected shelf with one serializable Aurora PostgreSQL query.' --homepage 'https://recall-h0.vercel.app' --visibility public";

console.log("Owner confirmation required before changing repository visibility.");
console.log("This helper only prints the command; it does not execute gh.");
console.log("");
console.log(command);
