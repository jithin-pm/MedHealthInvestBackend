fetch('http://localhost:5000/api/enquiry/type/Special')
  .then(r => r.json())
  .then(data => { console.log(JSON.stringify(data, null, 2)); process.exit(0); })
  .catch(err => { console.error(err); process.exit(1); });
