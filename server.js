const exp = require('express');
const app = exp();
const cors = require('cors');
const PORT = 3001;

app.use(cors());

app.get('/health-check', (req, res) => {
	res.send('Hello!');
});
/*
app.get('/hello', (req, res) => {
	res.send('Hello!');
});
*/
app.listen(PORT, () => {
	console.log(`Server is running on ${PORT}`);
});