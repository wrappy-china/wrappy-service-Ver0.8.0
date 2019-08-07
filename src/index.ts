
import express from "express"
import parser from "body-parser"
import fs from "fs"
import https from "https"
import jwt from "jsonwebtoken"
import exjwt from "express-jwt"
const WebSocket = require('ws');
const secret = 'SLKJEJJejjwIJE'
const jwtMW = exjwt({
    secret: secret
})


const core = require('./core')

 
const server = express()
server.use(parser.json()
)

/*****   AUTHENTICATE   ******/
server.post('/provider/authenticate', async function (req, res) {
    let response = await core.authenticate(req)
    if (response.code === 100) {
        let token = jwt.sign({ id: response.data.id, peer: response.data.servicePeer.id }, secret, { expiresIn: 604800 });
        res.json({
            success: true,
            token,
            data: {
                provider: {
                    id: response.data.id,
                    name: response.data.name
                },
                peer: {
                    id: response.data.servicePeer.id,
                    name: response.data.servicePeer.name,
                    balance: response.data.servicePeer.wallet.balance
                }
            },
            error: null
        })
    }
    else {
        res.status(401).json({
            success: false,
            token: null,
            data: null,
            error: response.data
        })
    }
})

/*****   AUTHENTICATE USER  ******/
server.post('/user/authenticate', async function (req, res) {
    let response = await core.authenticateServiceUser(req)
    if (response.code === 100) {
        let token = jwt.sign({ id: response.data.id, peer: response.data.membership.getIdentifier(), type: response.data.type }, secret, { expiresIn: 604800 });
        res.json({
            success: true,
            token,
            data: {
                provider: response.data.membership.getIdentifier()
            },
            error: null
        })
    }
    else {
        res.status(401).json({
            success: false,
            token: null,
            data: null,
            error: response.data
        })
    }
})

/*****   REGISTER SERVICE USER   ******/
server.post('/user/register', async function (req, res) {
    const response = await core.registerServiceUser(req)
    res.send(response)
})

/*****   UPDATE SERVICE USER   ******/
server.post('/user/update', jwtMW, async function (req, res) {
    const response = await core.updateServiceUser(req)
    res.send(response)
})

/*****   UPDATE SERVICE PROVIDER   ******/
server.post('/provider/update', jwtMW, async function (req, res) {
    const response = await core.updateServiceProvider(req)
    res.send(response)
})

/*****   REGISTER COUPON   ******/
server.post('/provider/coupon/register', jwtMW, async function (req, res) {
    const response = await core.registerCoupon(req)
    res.send(response)
})

/*****   ISSUE COUPON   ******/
server.post('/provider/coupon/issue', jwtMW, async function (req, res) {
    const response = await core.issueCoupon(req)
    res.send(response)
})

/*****   REDEEM COUPON   ******/
server.post('/user/coupon/redeem', jwtMW, async function (req, res) {
    const response = await core.redeemCoupon(req)
    res.send(response)
})

/*****   TRANSFER COUPON   ******/
server.post('/user/coupon/transfer', jwtMW, async function (req, res) {
    const response = await core.transferCoupon(req)
    res.send(response)
})

/*****   STORE: SETTLE COUPON   ******/
server.post('/user/coupon/settle', jwtMW, async function (req, res) {
    const response = await core.settleCoupon(req)
    res.send(response)
})

/*****   USER BALANCE  ******/
server.get('/user/coupon/balance', jwtMW, async function (req, res) {
    const response = await core.couponBalance(req)
    res.send(response)
})

/*****   USER: COUPON INFO  ******/
server.post('/user/coupon/info', jwtMW, async function (req, res) {
    const response = await core.couponInfo(req)
    res.send(response)
})

/*****   PROVIDER: COUPON INFO  ******/
server.post('/provider/coupon/info', jwtMW, async function (req, res) {
    const response = await core.couponInfo(req)
    res.send(response)
})

/*****   STORE:  USER LIST  ******/
server.get('/user/redeemer/list', jwtMW, async function (req, res) {
    const response = await core.redeemerList(req)
    res.send(response)
})

/*****   PROVIDER:  USER LIST  ******/
server.post('/provider/user/list', jwtMW, async function (req, res) {
    const response = await core.userList(req)
    res.send(response)
})

/*****   ACTIVATE COUPON   ******/
server.post('/provider/coupon/activate', jwtMW, async function (req, res) {
    const response = await core.activateCoupon(req)
    res.send(response)
})

/*****   DEACTIVATE COUPON   ******/
server.post('/provider/coupon/deactivate', jwtMW, async function (req, res) {
    const response = await core.deactivateCoupon(req)
    res.send(response)
})

/***** LIST COUPON: USER ******/
server.post('/user/coupon/list', jwtMW, async function (req, res) {
    const response = await core.listCouponUser(req)
    res.send(response)
})

/***** LIST ASSET ******/
server.get('/provider/asset/list', jwtMW, async function (req, res) {
    const response = await core.listAsset(req)
    res.send(response)
})

/***** LIST COUPON: PROVIDER ******/
server.post('/provider/coupon/list', jwtMW, async function (req, res) {
    const response = await core.listCouponProvider(req)
    res.send(response)
})

/***** USER: TRANSACTION HISTORY ******/
server.post('/user/transaction/history', jwtMW, async function (req, res) {
    const response = await core.transactionHistory(req)
    res.send(response)
})

/***** PROVIDER: TRANSACTION HISTORY ******/
server.post('/provider/transaction/history', jwtMW, async function (req, res) {
    const response = await core.transactionHistory(req)
    res.send(response)
})

/***** BALANCE ******/
server.get('/balance', jwtMW, async function (req, res) {
    const response = await core.balance(req)
    res.send(response)
})

/***** TRANSFER ******/
server.post('/transfer/proteusion', jwtMW, async function (req, res) {
    const response = await core.transfer(req)
    res.send(response)
})


/***** CREDIT PURCHASE ******/
server.post('/purchase/credit', jwtMW, async function (req, res) {
    const response = await core.purchaseCredit(req)
    res.send(response)
})

/***** CANCEL CREDIT PURCHASE ******/
server.post('/cancel/credit', jwtMW, async function (req, res) {
    const response = await core.cancelCredit(req)
    res.send(response)
})

/***** LIST BANKS ******/
server.get('/list/bank', jwtMW, async function (req, res) {
    const response = await core.listBank(req)
    res.send(response)
})

/***** LIST CREDIT PURCHASE ******/
server.get('/list/credit', jwtMW, async function (req, res) {
    const response = await core.listCredit(req)
    res.send(response)
})

/***** LIST PROTEUSION TRANSFER ******/
server.get('/list/proteusion', jwtMW, async function (req, res) {
    const response = await core.listProteusionTransfer(req)
    res.send(response)
})

/***** LIST TOKEN TRANSFER ******/
server.get('/list/token', jwtMW, async function (req, res) {
    const response = await core.listTokenTransfer(req)
    res.send(response)
})

/***** LIST SERVICE MINT ******/
server.get('/list/mint', jwtMW, async function (req, res) {
    const response = await core.listServiceMint(req)
    res.send(response)
})

/***** REGISTER USER ******/
server.post('/register/user', jwtMW, async function (req, res) {
    const response = await core.registerUser(req)
    res.send(response)
})

/***** UPDATE USER ******/
server.post('/update/user', jwtMW, async function (req, res) {
    const response = await core.updateUser(req)
    res.send(response)
})

/***** REGISTER SERVICE MINT *****/
server.post('/register/mint', jwtMW, async function (req, res) {
    const response = await core.registerServiceMint(req)
    res.send(response)
})

/***** CANCEL SERVICE MINT *****/
server.post('/cancel/mint', jwtMW, async function (req, res) {
    const response = await core.cancelServiceMint(req)
    res.send(response)
})

/***** APPROVE SERVICE MINT *****/
server.post('/approve/mint', jwtMW, async function (req, res) {
    const response = await core.approveServiceMint(req)
    res.send(response)
})

/*** NEW FUNCTIONALITIES ***/



/***** REJECT SERVICE MINT  *****/
server.post('/reject/mint', jwtMW, async function (req, res) {
    const response = await core.rejectServiceMint(req)
    res.send(response)
})

/***** REGISTER SERVICE TOKEN *****/
server.post('/register/token', jwtMW, async function (req, res) {
    const response = await core.registerServiceToken(req)
    res.send(response)
})

/***** SET SERVICE CONFIG *****/
server.post('/set/config', jwtMW, async function (req, res) {
    const response = await core.setServiceConfig(req)
    res.send(response)
})

/***** SERVICE TOKEN TRANSFER *****/
server.post('/transfer/token', jwtMW, async function (req, res) {
    const response = await core.serviceTokenTransfer(req)
    res.send(response)
})


var port = process.env.PORT || 8500
const node = https.createServer({
    key: fs.readFileSync('private.key'),
    cert: fs.readFileSync('certificate.crt'),
    ca: fs.readFileSync('ca_bundle.crt'),
}, server).listen(port, function () {
    console.log('Wrappy Service API 2.0 Alpha')
    console.log('Server started on port %d', port)
})
/***** WEBSOCKET: EVENT *****/
const wss = new WebSocket.Server({ server: node, path: "/event" });

wss.broadcast = function broadcast(data) {
	wss.clients.forEach(function each(client) {
		if (client.readyState === WebSocket.OPEN) {
			client.send(data);
		}
	});
};

const BusinessNetworkConnection = require('composer-client').BusinessNetworkConnection
const network = 'wrappy-network'
const card = `admin@${network}`
const connection = new BusinessNetworkConnection()
connection.connect(card).then(() => {
console.log('Event Listener started...')
})

connection.on('event', (event) => {
console.log("========================================");
//console.log("Triggered Event: " + JSON.stringify(event.type));
//console.log("Transaction ID: " + JSON.stringify(event.id));
//console.log("Owner: " + JSON.stringify(event.owner));
//console.log("Recipient: " + JSON.stringify(event.recipient));
//console.log("Amount: " + JSON.stringify(event.amount));
console.log("========================================");
wss.broadcast(JSON.stringify(event))
});

wss.on('connection', function connection(ws) {
	         console.log('Linked！');
	         ws.on('message', function incoming(data) {
	             /**
	              * 把消息发送到所有的客户端
	              * wss.clients获取所有链接的客户端
	              */
//	             console.log(data)
	             if (data === "ping") {
//	             	 console.log("收到了客户端的心跳"+data)
	                ws.send("ping")
	             }            
	         });
});