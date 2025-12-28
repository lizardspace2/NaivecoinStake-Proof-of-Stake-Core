
const http = require('http');

http.get('http://localhost:3001/blocks', (res) => {
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    res.on('end', () => {
        try {
            const blocks = JSON.parse(data);
            const genesis = blocks[0];
            const amount = genesis.data[0].txOuts[0].amount;
            if (amount === 100000000) {
                console.log('SUCCESS: Genesis amount is 100,000,000');
            } else {
                console.error('FAILURE: Genesis amount is ' + amount);
                process.exit(1);
            }
        } catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
}).on('error', (err) => {
    console.error(err.message);
    process.exit(1);
});
