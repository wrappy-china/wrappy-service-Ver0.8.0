import Cryptr from "cryptr"
import { Response } from "./data"
import { BusinessNetworkConnection } from "composer-client"
import { AdminConnection } from "composer-admin"
import { IdCard } from "composer-common"
import fs from "fs"

/********** Cryto Constants **********/
const secret = 'OIEWROIWOiosdsds'
const cryptr = new Cryptr(secret)

const network = 'wrappy-network'

async function issueIdentity(participant, name) {
    const adminCard = `admin@${network}`
    const connection = new BusinessNetworkConnection()
    await connection.connect(adminCard)
    const result = await connection.issueIdentity(participant, name)
    var data = {
        id: result.userID,
        secret: result.userSecret
    }
    const adminConnection = new AdminConnection()
    const metadata = {
        version: 1,
        userName: result.userID,
        enrollmentSecret: result.userSecret,
        businessNetwork: connection.getBusinessNetwork().getName()
    }
    const profile = JSON.parse(fs.readFileSync("connection.json", 'UTF-8'))
    const idCardData = await new IdCard(metadata, profile)
    const idCardName = result.userID
    await adminConnection.importCard(idCardName, idCardData)
    await connection.disconnect()
    return data
}

module.exports = {
    authenticate: async function (request) {
        let response = new Response()
        try {
            const body = JSON.stringify(request.body)
            console.log("Method: authenticate")
            console.log(`Parameter: ${body}`)
            console.log('')

            /***** MANDATORY PARAM VALIDATION ******/
            if (!request.body.username) throw "Required field [username] is missing."
            if (!request.body.password) throw "Required field [password] is missing."
            if (!request.body.type) throw "Required field [type] is missing."

            const prefix = request.body.type.charAt(0).toUpperCase() + request.body.type.slice(1)
            const type = `Service${prefix}`
            const card = `admin@${network}`
            const connection = new BusinessNetworkConnection()
            await connection.connect(card)
            const query = connection.buildQuery(`SELECT net.wrappy.participant.${type} WHERE (id == _$id)`)
            const result = await connection.query(query, { id: request.body.username })
            if (result.length == 0) throw "Account does not exist."
            const registry = await connection.getParticipantRegistry(`net.wrappy.participant.${type}`)
            const user = await registry.resolve(result[0].id)
            if (cryptr.decrypt(user.password) === request.body.password) {
                response.data = user
            }
            else throw "You have specified an invalid password."
            response.code = 100
            response.description = 'SUCCESS'

            await connection.disconnect()
            console.log(response.description)
            console.log('')
        } catch (error) {
            console.log(error)
            console.log('')
            response.code = -100
            response.description = 'FAILED'
            if (error.message) error = JSON.stringify(error.message)
            response.data = error
        }
        return response
    },
    authenticateServiceUser: async function (request) {
        let response = new Response()
        try {
            const body = JSON.stringify(request.body)
            console.log("Method: authenticateServiceUser")
            console.log(`Parameter: ${body}`)
            console.log('')

            /***** MANDATORY PARAM VALIDATION ******/
            if (!request.body.username) throw "Required field [username] is missing."
            if (!request.body.password) throw "Required field [password] is missing."

            const card = `admin@${network}`
            const connection = new BusinessNetworkConnection()
            await connection.connect(card)
            const query = connection.buildQuery('SELECT net.wrappy.participant.ServiceUser WHERE (id == _$id)')
            const result = await connection.query(query, { id: request.body.username })
            if (result.length == 0) throw "Account does not exist."
            const registry = await connection.getParticipantRegistry(`net.wrappy.participant.ServiceUser`)

            const user = await registry.get(result[0].id)
            if (cryptr.decrypt(user.password) === request.body.password) {
                response.data = user
            }
            else throw "You have specified an invalid password."
            response.code = 100
            response.description = 'SUCCESS'

            await connection.disconnect()
            console.log(response.description)
            console.log('')
        } catch (error) {
            console.log(error)
            console.log('')
            response.code = -100
            response.description = 'FAILED'
            if (error.message) error = JSON.stringify(error.message)
            response.data = error
        }
        return response
    },
    registerServiceUser: async function (request) {
        let response = new Response()
        try {
            const body = JSON.stringify(request.body)
            console.log("Method: registerServiceUser")
            console.log(`Parameter: ${body}`)
            console.log('')

            /***** MANDATORY PARAM VALIDATION ******/
            if (!request.body.id) throw "Required field [id] is missing."
            if (!request.body.name) throw "Required field [name] is missing."
            if (!request.body.password) throw "Required field [password] is missing."
            if (!request.body.provider) throw "Required field [provider] is missing."
            if (!request.body.type) throw "Required field [type] is missing."

            const card = `registryProvider@${network}`
            const connection = new BusinessNetworkConnection()
            const definition = await connection.connect(card)
            const factory = definition.getFactory()

            const id = request.body.id
            const transaction = factory.newTransaction(`net.wrappy.transaction.registry`, `registerServiceUser`)
            const providerReference = factory.newRelationship('net.wrappy.asset.service', 'ServicePeer', request.body.provider)
 
            transaction.id = id
            transaction.name = request.body.name
            transaction.type = request.body.type
            transaction.membership = providerReference
            transaction.password = cryptr.encrypt(request.body.password)
            transaction.note = ""

            transaction.date = new Date()
            await connection.submitTransaction(transaction)
            await connection.disconnect()

            response.code = 100
            response.description = 'SUCCESS'

            console.log("Issuing identity ...")
            console.log('')
            response.data = await issueIdentity(`net.wrappy.participant.ServiceUser#${id}@${request.body.provider}`, `${id}@${request.body.provider}`)
            console.log(response.description)
            console.log('')
        } catch (error) {
            response.code = -100
            response.description = 'FAILED'
            try {
                if (error.message) {
                    const regex = new RegExp("failure: (.*)")
                    const msg = regex.exec(error.message)
                    error = msg[1]
                }
            }
            catch (e) { }
            console.log(error)
            console.log('')
            response.data = error
        }
        return response
    }, 
    updateServiceUser: async function (request) {
        let response = new Response()
        try {
            const body = JSON.stringify(request.body)
            console.log("Method: updateServiceUser")
            console.log(`Card: ${request.user.id}`)
            console.log(`Parameter: ${body}`)
            console.log('')

            const card = request.user.id
            const connection = new BusinessNetworkConnection()
            const definition = await connection.connect(card)
            const factory = definition.getFactory()
            const transaction = factory.newTransaction(`net.wrappy.transaction.serviceuser`, `updateServiceUser`)

            if (request.body.name) transaction.name = request.body.name
            if (request.body.password) transaction.password = cryptr.encrypt(request.body.password)
            if (request.body.gender) transaction.gender = request.body.gender
            if (request.body.birth) transaction.birth = Date.parse(request.body.birth)
            if (request.body.nationality) transaction.nationality = request.body.nationality
            if (request.body.contact) {
                const contact = factory.newConcept('net.wrappy.participant.common', 'Contact')
                if (request.body.contact.email) contact.email = request.body.contact.email
                if (request.body.contact.phone) contact.phone = request.body.contact.phone
                if (request.body.contact.mobile) contact.mobile = request.body.contact.mobile
                transaction.contact = contact
            }
            if (request.body.address) {
                const address = factory.newConcept('net.wrappy.participant.common', 'Address')
                address.addressLine1 = request.body.address.addressLine1
                if (request.body.address.addressLine2) address.addressLine2 = request.body.address.addressLine2
                address.city = request.body.address.city
                address.state = request.body.address.state
                address.zip = request.body.address.zip
                address.country = request.body.address.country
                transaction.address = address
            }
            await connection.submitTransaction(transaction)
            await connection.disconnect()
            response.code = 100
            response.description = 'SUCCESS'
        } catch (error) {
            response.code = -100
            response.description = 'FAILED'
            try {
                if (error.message) {
                    const regex = new RegExp("failure: (.*)")
                    const msg = regex.exec(error.message)
                    error = msg[1]
                }
            }
            catch (e) { }
            console.log(error)
            console.log('')
            response.data = error
        }
        return response
    },    
    updateServiceProvider: async function (request) {
        let response = new Response()
        try {
            const body = JSON.stringify(request.body)
            console.log("Method: updateServiceProvider")
            console.log(`Card: ${request.user.id}`)
            console.log(`Parameter: ${body}`)
            console.log('')

            const card = `${request.user.id}@${network}`
            const connection = new BusinessNetworkConnection()
            const definition = await connection.connect(card)
            const factory = definition.getFactory()
            const transaction = factory.newTransaction(`net.wrappy.transaction.service`, `updateServiceProvider`)

            if (request.body.name) transaction.name = request.body.name
            if (request.body.password) transaction.password = cryptr.encrypt(request.body.password)
            if (request.body.gender) transaction.gender = request.body.gender
            if (request.body.birth) transaction.birth = Date.parse(request.body.birth)
            if (request.body.nationality) transaction.nationality = request.body.nationality
            if (request.body.contact) {
                const contact = factory.newConcept('net.wrappy.participant.common', 'Contact')
                if (request.body.contact.email) contact.email = request.body.contact.email
                if (request.body.contact.phone) contact.phone = request.body.contact.phone
                if (request.body.contact.mobile) contact.mobile = request.body.contact.mobile
                transaction.contact = contact
            }
            if (request.body.address) {
                const address = factory.newConcept('net.wrappy.participant.common', 'Address')
                address.addressLine1 = request.body.address.addressLine1
                if (request.body.address.addressLine2) address.addressLine2 = request.body.address.addressLine2
                address.city = request.body.address.city
                address.state = request.body.address.state
                address.zip = request.body.address.zip
                address.country = request.body.address.country
                transaction.address = address
            }
            await connection.submitTransaction(transaction)
            await connection.disconnect()
            response.code = 100
            response.description = 'SUCCESS'
        } catch (error) {
            response.code = -100
            response.description = 'FAILED'
            try {
                if (error.message) {
                    const regex = new RegExp("failure: (.*)")
                    const msg = regex.exec(error.message)
                    error = msg[1]
                }
            }
            catch (e) { }
            console.log(error)
            console.log('')
            response.data = error
        }
        return response
    },   
    issueCoupon: async function (request) {
        let response = new Response()
        try {
            const body = JSON.stringify(request.body)
            console.log("Method: issueCoupon")
            console.log(`Card: ${request.user.id}`)
            console.log(`Parameter: ${body}`)
            console.log('')

            /***** MANDATORY PARAM VALIDATION ******/
            if (!request.body.recipient) throw "Required field [recipient] is missing."
            if (!request.body.coupon) throw "Required field [coupon] is missing."
            if (typeof(request.body.quantity) !== 'number') throw "Required field [quantity] is missing."
            if (typeof(request.body.expiry) !== 'number') throw "Required field [expiry] is missing."
            if (typeof(request.body.value) !== 'number') throw "Required field [value] is missing."

            const uniqueID = require('uniqid');
            
            const card = `${request.user.id}@${network}`
            const connection = new BusinessNetworkConnection()
            const definition = await connection.connect(card)
            const factory = definition.getFactory()
            const transaction = factory.newTransaction(`net.wrappy.transaction.service`, `issueCoupon`)
            let recipientReference = factory.newRelationship('net.wrappy.participant', 'ServiceUser', request.body.recipient)
            let couponReference = factory.newRelationship('net.wrappy.asset.common', 'DigitalAsset', request.body.coupon)

            let uuids= []
            for (let i = 0; i < request.body.quantity; i++) {
                uuids[i] = uniqueID().toUpperCase()
             } 
            transaction.id = uuids
            transaction.quantity = request.body.quantity
            transaction.value = request.body.value
            transaction.expiry = request.body.expiry
            transaction.coupon = couponReference
            transaction.recipient = recipientReference
            await connection.submitTransaction(transaction)
            await connection.disconnect()

            response.code = 100
            response.description = 'SUCCESS'
            response.data = uuids
            console.log(response.description)
            console.log('')
        } catch (error) {
            response.code = -100
            response.description = 'FAILED'
            try {
                if (error.message) {
                    const regex = new RegExp("failure: (.*)")
                    const msg = regex.exec(error.message)
                    error = msg[1]
                }
            }
            catch (e) { }
            console.log(error)
            console.log('')
            response.data = error
        }
        return response
    },
    registerCoupon: async function (request) {
        let response = new Response()
        try {
            const body = JSON.stringify(request.body)
            console.log("Method: registerCoupon")
            console.log(`Card: ${request.user.id}`)
            console.log(`Parameter: ${body}`)
            console.log('')

            /***** MANDATORY PARAM VALIDATION ******/
            if (!request.body.name) throw "Required field [name] is missing."
            if (!request.body.denomination) throw "Required field [denomination] is missing."
            if (!Array.isArray(request.body.denomination)) throw "Required field [denomination] must be an Array of Integer."
            
            const card = `${request.user.id}@${network}`
            const connection = new BusinessNetworkConnection()
            const definition = await connection.connect(card)
            const factory = definition.getFactory()
            const uniqueID = require('uniqid');
            const uuid = uniqueID().toUpperCase()

            const transaction = factory.newTransaction(`net.wrappy.transaction.service`, `registerCoupon`)
            transaction.id = uuid
            transaction.name = request.body.name
            transaction.denomination = request.body.denomination
            await connection.submitTransaction(transaction)
            await connection.disconnect()

            response.code = 100
            response.description = 'SUCCESS'
            response.data = uuid
            console.log(response.description)
            console.log('')
        } catch (error) {
            response.code = -100
            response.description = 'FAILED'
            try {
                if (error.message) {
                    const regex = new RegExp("failure: (.*)")
                    const msg = regex.exec(error.message)
                    error = msg[1]
                }
            }
            catch (e) { }
            console.log(error)
            console.log('')
            response.data = error
        }
        return response
    },
    listCouponUser: async function (request) {
        let response = new Response()
        try {
            const body = JSON.stringify(request.body)
            console.log("Method: listCouponUser")
            console.log(`Card: ${request.user.id}`)
            console.log(`Parameter: ${body}`)
            console.log('')
            
            /***** MANDATORY PARAM VALIDATION ******/
            if (!request.body.filter) throw "Required field [filter] is missing."
            const filter = request.body.filter.toUpperCase()
            let ownerType = "owner"
            let postfix = ""
            if (request.user.type == 'CONSUMER') {
                if ((filter != 'ACTIVE') && (filter != 'DEACTIVATED') && (filter != 'USED') && (filter != 'SETTLED') && (filter != 'ALL'))  throw "Allowed filter values ['ALL', 'ACTIVE', 'DEACTIVATED', 'USED', 'SETTLED']"
            }
            else {
                if ((filter != 'USED') && (filter != 'SETTLED') && (filter != 'ALL'))  throw "Allowed filter values ['ALL', 'USED', 'SETTLED']"
                ownerType = "usedStore"
            }
            if (filter != "ALL") postfix = `AND (status == "${filter}")`    
        
            const card = `admin@${network}`
            const connection = new BusinessNetworkConnection()
            await connection.connect(card)
            const query = connection.buildQuery(`SELECT net.wrappy.asset.service.Coupon WHERE ((${ownerType} == _$owner) ${postfix})`)
            const result = await connection.query(query, { owner: `resource:net.wrappy.participant.ServiceUser#${request.user.id}` })
            if (result.length == 0) throw "No coupon found."
            response.data = result
            response.code = 100
            response.description = 'SUCCESS'

            await connection.disconnect()
            console.log(response.description)
            console.log('')
        } catch (error) {
            console.log(error)
            console.log('')
            response.code = -100
            response.description = 'FAILED'
            if (error.message) error = JSON.stringify(error.message)
            response.data = error
        }
        return response
    },
    listCouponProvider: async function (request) {
        let response = new Response()
        try {
            const body = JSON.stringify(request.body)
            console.log("Method: listCouponUser")
            console.log(`Card: ${request.user.id}`)
            console.log(`Parameter: ${body}`)
            console.log('')

            /***** MANDATORY PARAM VALIDATION ******/
            if (!request.body.filter) throw "Required field [filter] is missing."
            const filter = request.body.filter.toUpperCase()
    
            let postfix = ""
            if ((filter != 'ACTIVE') && (filter != 'DEACTIVATED') && (filter != 'USED') && (filter != 'SETTLED') && (filter != 'ALL'))  throw "Allowed filter values ['ALL', 'ACTIVE', 'DEACTIVATED', 'USED', 'SETTLED']"
                  
            if (filter != "ALL") postfix = `WHERE (status == "${filter}")`    
        
            const card = `admin@${network}`
            const connection = new BusinessNetworkConnection()
            await connection.connect(card)
            const query = connection.buildQuery(`SELECT net.wrappy.asset.service.Coupon ${postfix}`)
            const result = await connection.query(query)
            if (result.length == 0) throw "No coupon found."
            response.data = result
            response.code = 100
            response.description = 'SUCCESS'

            await connection.disconnect()
            console.log(response.description)
            console.log('')
        } catch (error) {
            console.log(error)
            console.log('')
            response.code = -100
            response.description = 'FAILED'
            if (error.message) error = JSON.stringify(error.message)
            response.data = error
        }
        return response
    },
    transactionHistory: async function (request) {
        let response = new Response()
        try {
            const body = JSON.stringify(request.body)
            console.log("Method: transactionHistory")
            console.log(`Card: ${request.user.id}`)
            console.log(`Parameter: ${body}`)
            console.log('')

            /***** MANDATORY PARAM VALIDATION ******/
            if (!request.body.dateFrom) throw "Required field [dateFrom] is missing."
            if (!request.body.dateTo) throw "Required field [dateTo] is missing."
           
        
            const card = `admin@${network}`
            const connection = new BusinessNetworkConnection()
            await connection.connect(card)

            const query = connection.buildQuery('SELECT net.wrappy.asset.common.CouponHistory WHERE ((owner == _$owner) AND (( _$dateFrom < date) AND (_$dateTo > date)) )')
            const result = await connection.query(query, { dateFrom: request.body.dateFrom, dateTo: request.body.dateTo,  owner: `resource:net.wrappy.participant.ServiceUser#${request.user.id}` })
            if (result.length == 0) throw "No record found."

            response.data = result
            response.code = 100
            response.description = 'SUCCESS'

            await connection.disconnect()
            console.log(response.description)
            console.log('')
        } catch (error) {
            console.log(error)
            console.log('')
            response.code = -100
            response.description = 'FAILED'
            if (error.message) error = JSON.stringify(error.message)
            response.data = error
        }
        return response
    },
    couponInfo: async function (request) {
        let response = new Response()
        try {
            const body = JSON.stringify(request.body)
            console.log("Method: couponInfo")
            console.log(`Card: ${request.user.id}`)
            console.log(`Parameter: ${body}`)
            console.log('')

            /***** MANDATORY PARAM VALIDATION ******/
            if (!request.body.coupon) throw "Required field [coupon] is missing."

            const card = `admin@${network}`
            const connection = new BusinessNetworkConnection()
            await connection.connect(card)

            const query = connection.buildQuery('SELECT net.wrappy.asset.service.Coupon WHERE (id == _$id)')
            const result = await connection.query(query, { id: request.body.coupon })
            if (result.length == 0) throw "No record found."

            response.data = result[0]
            response.code = 100
            response.description = 'SUCCESS'

            await connection.disconnect()
            console.log(response.description)
            console.log('')
        } catch (error) {
            console.log(error)
            console.log('')
            response.code = -100
            response.description = 'FAILED'
            if (error.message) error = JSON.stringify(error.message)
            response.data = error
        }
        return response
    },
    couponBalance: async function (request) {
        let response = new Response()
        try {
            const body = JSON.stringify(request.body)
            console.log("Method: couponBalance")
            console.log(`Card: ${request.user.id}`)
            console.log('')

            const card = `admin@${network}`
            const connection = new BusinessNetworkConnection()
            await connection.connect(card)

            const participantRegistry = await connection.getParticipantRegistry("net.wrappy.participant.ServiceUser")
            const user = await participantRegistry.get(request.user.id)
            response.data = {
               activeBalance: user.wallet.coupon.activeBalance,
               deactivatedBalance: user.wallet.coupon.deactivatedBalance,
               input: user.wallet.coupon.input,
               output: user.wallet.coupon.output 
            }

            response.code = 100
            response.description = 'SUCCESS'

            await connection.disconnect()
            console.log(response.description)
            console.log('')
        } catch (error) {
            console.log(error)
            console.log('')
            response.code = -100
            response.description = 'FAILED'
            if (error.message) error = JSON.stringify(error.message)
            response.data = error
        }
        return response
    },
    redeemerList: async function (request) {
        let response = new Response()
        try {
            const body = JSON.stringify(request.body)
            console.log("Method: redeemerList")
            console.log(`Card: ${request.user.id}`)
            console.log('')

            const card = `admin@${network}`
            const connection = new BusinessNetworkConnection()
            await connection.connect(card)
            const query = connection.buildQuery('SELECT net.wrappy.asset.common.StoreUser WHERE (store == _$store)')
            const result = await connection.query(query, { store: `resource:net.wrappy.participant.ServiceUser#${request.user.id}` })
            if (result.length == 0) throw "No users found."
            response.data = result
            response.code = 100
            response.description = 'SUCCESS'

            await connection.disconnect()
            console.log(response.description)
            console.log('')
        } catch (error) {
            console.log(error)
            console.log('')
            response.code = -100
            response.description = 'FAILED'
            if (error.message) error = JSON.stringify(error.message)
            response.data = error
        }
        return response
    },
    userList: async function (request) {
        let response = new Response()
        try {
            const body = JSON.stringify(request.body)
            console.log("Method: userList")
            console.log(`Card: ${request.user.id}`)
            console.log(`Parameter: ${body}`)
            console.log('')

            /***** MANDATORY PARAM VALIDATION ******/
            if (!request.body.filter) throw "Required field [filter] is missing."
            const filter = request.body.filter.toUpperCase()
            if ((filter != 'STORE') && (filter != 'CONSUMER') && (filter != 'ALL'))  throw "Allowed filter values ['ALL', 'STORE', 'CONSUMER']"
           
            let postfix = ""
            if (filter != "ALL") postfix = `AND (type == "${filter}")`    
            
            const card = `admin@${network}`
            const connection = new BusinessNetworkConnection()
            await connection.connect(card)
            const query = connection.buildQuery(`SELECT net.wrappy.participant.ServiceUser WHERE ((membership == _$membership) ${postfix})`)
            const result = await connection.query(query, { membership: `resource:net.wrappy.asset.service.ServicePeer#${request.user.peer}` })
            if (result.length == 0) throw "No users found."
            response.data = result
            response.code = 100
            response.description = 'SUCCESS'

            await connection.disconnect()
            console.log(response.description)
            console.log('')
        } catch (error) {
            console.log(error)
            console.log('')
            response.code = -100
            response.description = 'FAILED'
            if (error.message) error = JSON.stringify(error.message)
            response.data = error
        }
        return response
    },    
    listAsset: async function (request) {
        let response = new Response()
        try {
            const body = JSON.stringify(request.body)
            console.log("Method: listAsset")
            console.log(`Card: ${request.user.id}`)
            console.log('')

            const card = `admin@${network}`
            const connection = new BusinessNetworkConnection()
            await connection.connect(card)
            const query = connection.buildQuery('SELECT net.wrappy.asset.common.DigitalAsset WHERE (owner == _$owner)')
            const result = await connection.query(query, { owner: `resource:net.wrappy.asset.service.ServicePeer#${request.user.peer}` })
            if (result.length == 0) throw "No asset registered."
            response.data = result
            response.code = 100
            response.description = 'SUCCESS'

            await connection.disconnect()
            console.log(response.description)
            console.log('')
        } catch (error) {
            console.log(error)
            console.log('')
            response.code = -100
            response.description = 'FAILED'
            if (error.message) error = JSON.stringify(error.message)
            response.data = error
        }
        return response
    },
    redeemCoupon: async function (request) {
        let response = new Response()
        try {
            const body = JSON.stringify(request.body)
            console.log("Method: redeemCoupon")
            console.log(`Card: ${request.user.id}`)
            console.log(`Parameter: ${body}`)
            console.log('')

            /***** MANDATORY PARAM VALIDATION ******/
            if (!request.body.coupon) throw "Required field [coupon] is missing."
            if (!Array.isArray(request.body.coupon)) throw "Required field [coupon] must be an Array of Coupon."
            if (!request.body.store) throw "Required field [store] is missing."

            const uniqueID = require('uniqid');

            const card = request.user.id
            const connection = new BusinessNetworkConnection()
            const definition = await connection.connect(card)
            const factory = definition.getFactory()
            const transaction = factory.newTransaction('net.wrappy.transaction.serviceuser', 'redeemCoupon')
            let storeReference = factory.newRelationship('net.wrappy.participant', 'ServiceUser', request.body.store)

            let uuids= []
            for (let i = 0; i < request.body.coupon.length; i++) {
                uuids[i] = uniqueID().toUpperCase()
             } 
            transaction.id = uuids
            transaction.storeUserId = uniqueID().toUpperCase()
            transaction.coupon = request.body.coupon
            transaction.store = storeReference
            await connection.submitTransaction(transaction)
            await connection.disconnect()

            response.code = 100
            response.description = 'SUCCESS'
            response.data = request.body.uuids

            console.log(response.description)
            console.log('')
        } catch (error) {
            response.code = -100
            response.description = 'FAILED'
            try {
                if (error.message) {
                    const regex = new RegExp("failure: (.*)")
                    const msg = regex.exec(error.message)
                    error = msg[1]
                }
            }
            catch (e) { }
            console.log(error)
            console.log('')
            response.data = error
        }
        return response
    },
    transferCoupon: async function (request) {
        let response = new Response()
        try {
            const body = JSON.stringify(request.body)
            console.log("Method: transferCoupon")
            console.log(`Card: ${request.user.id}`)
            console.log(`Parameter: ${body}`)
            console.log('')

            /***** MANDATORY PARAM VALIDATION ******/
            if (!request.body.coupon) throw "Required field [coupon] is missing."
            if (!Array.isArray(request.body.coupon)) throw "Required field [coupon] must be an Array of Coupon."
            if (!request.body.recipient) throw "Required field [recipient] is missing."

            const uniqueID = require('uniqid');

            const card = request.user.id
            const connection = new BusinessNetworkConnection()
            const definition = await connection.connect(card)
            const factory = definition.getFactory()
            const transaction = factory.newTransaction('net.wrappy.transaction.serviceuser', 'transferCoupon')
            let recipientReference = factory.newRelationship('net.wrappy.participant', 'ServiceUser', request.body.recipient)

            let uuids= []
            for (let i = 0; i < request.body.coupon.length; i++) {
                uuids[i] = uniqueID().toUpperCase()
             } 
            transaction.id = uuids
            transaction.coupon = request.body.coupon
            transaction.recipient = recipientReference
            await connection.submitTransaction(transaction)
            await connection.disconnect()

            response.code = 100
            response.description = 'SUCCESS'
            response.data = request.body.uuids

            console.log(response.description)
            console.log('')
        } catch (error) {
            response.code = -100
            response.description = 'FAILED'
            try {
                if (error.message) {
                    const regex = new RegExp("failure: (.*)")
                    const msg = regex.exec(error.message)
                    error = msg[1]
                }
            }
            catch (e) { }
            console.log(error)
            console.log('')
            response.data = error
        }
        return response
    },
    settleCoupon: async function (request) {
        let response = new Response()
        try {
            const body = JSON.stringify(request.body)
            console.log("Method: settleCoupon")
            console.log(`Card: ${request.user.id}`)
            console.log(`Parameter: ${body}`)
            console.log('')

            /***** MANDATORY PARAM VALIDATION ******/
            if (!request.body.coupon) throw "Required field [coupon] is missing."
            if (!Array.isArray(request.body.coupon)) throw "Required field [coupon] must be an Array of Coupon."

            const uniqueID = require('uniqid');
            const uuid = uniqueID().toUpperCase()

            const card = request.user.id
            const connection = new BusinessNetworkConnection()
            const definition = await connection.connect(card)
            const factory = definition.getFactory()
            const transaction = factory.newTransaction('net.wrappy.transaction.serviceuser', 'settleCoupon')
            let uuids= []
            for (let i = 0; i < request.body.coupon.length; i++) {
                uuids[i] = uniqueID().toUpperCase()
             } 
            transaction.id = uuids
            transaction.coupon = request.body.coupon
            await connection.submitTransaction(transaction)
            await connection.disconnect()

            response.code = 100
            response.description = 'SUCCESS'
            response.data = uuids

            console.log(response.description)
            console.log('')
        } catch (error) {
            response.code = -100
            response.description = 'FAILED'
            try {
                if (error.message) {
                    const regex = new RegExp("failure: (.*)")
                    const msg = regex.exec(error.message)
                    error = msg[1]
                }
            }
            catch (e) { }
            console.log(error)
            console.log('')
            response.data = error
        }
        return response
    },
    activateCoupon: async function (request) {
        let response = new Response()
        try {
            const body = JSON.stringify(request.body)
            console.log("Method: activateCoupon")
            console.log(`Card: ${request.user.id}`)
            console.log(`Parameter: ${body}`)
            console.log('')

            /***** MANDATORY PARAM VALIDATION ******/
            if (!request.body.coupon) throw "Required field [coupon] is missing."
            if (!Array.isArray(request.body.coupon)) throw "Required field [coupon] must be an Array of Coupon."

            const card = `${request.user.id}@${network}`
            const connection = new BusinessNetworkConnection()
            const definition = await connection.connect(card)
            const factory = definition.getFactory()
            const transaction = factory.newTransaction('net.wrappy.transaction.service', 'activateCoupon')
            transaction.coupon = request.body.coupon
            await connection.submitTransaction(transaction)
            await connection.disconnect()

            response.code = 100
            response.description = 'SUCCESS'
            response.data = request.body.coupon

            console.log(response.description)
            console.log('')
        } catch (error) {
            response.code = -100
            response.description = 'FAILED'
            try {
                if (error.message) {
                    const regex = new RegExp("failure: (.*)")
                    const msg = regex.exec(error.message)
                    error = msg[1]
                }
            }
            catch (e) { }
            console.log(error)
            console.log('')
            response.data = error
        }
        return response
    },
    deactivateCoupon: async function (request) {
        let response = new Response()
        try {
            const body = JSON.stringify(request.body)
            console.log("Method: deactivateCoupon")
            console.log(`Card: ${request.user.id}`)
            console.log(`Parameter: ${body}`)
            console.log('')

            /***** MANDATORY PARAM VALIDATION ******/
            if (!request.body.coupon) throw "Required field [coupon] is missing."
            if (!Array.isArray(request.body.coupon)) throw "Required field [coupon] must be an Array of Coupon."
            if (!request.body.reason) throw "Required field [reason] is missing."

            const card = `${request.user.id}@${network}`
            const connection = new BusinessNetworkConnection()
            const definition = await connection.connect(card)
            const factory = definition.getFactory()
            const transaction = factory.newTransaction('net.wrappy.transaction.service', 'deactivateCoupon')
            transaction.coupon = request.body.coupon
            transaction.reason = request.body.reason
            await connection.submitTransaction(transaction)
            await connection.disconnect()

            response.code = 100
            response.description = 'SUCCESS'
            response.data = request.body.coupon

            console.log(response.description)
            console.log('')
        } catch (error) {
            response.code = -100
            response.description = 'FAILED'
            try {
                if (error.message) {
                    const regex = new RegExp("failure: (.*)")
                    const msg = regex.exec(error.message)
                    error = msg[1]
                }
            }
            catch (e) { }
            console.log(error)
            console.log('')
            response.data = error
        }
        return response
    },
    expireCoupon: async function (request) {
        let response = new Response()
        try {
            const body = JSON.stringify(request.body)
            console.log("Method: deactivateCoupon")
            console.log(`Card: ${request.user.id}`)
            console.log(`Parameter: ${body}`)
            console.log('')

            /***** MANDATORY PARAM VALIDATION ******/
            if (!request.body.coupon) throw "Required field [coupon] is missing."
            if (!Array.isArray(request.body.coupon)) throw "Required field [coupon] must be an Array of Coupon."
            if (!request.body.reason) throw "Required field [reason] is missing."

            const card = `${request.user.id}@${network}`
            const connection = new BusinessNetworkConnection()
            const definition = await connection.connect(card)
            const factory = definition.getFactory()
            const query = connection.buildQuery(`SELECT net.wrappy.asset.service.Coupon WHERE ( issuedBy == _$owner AND status == "ACTIVE" )` );
            const result = await connection.query(query, { owner: `resource:net.wrappy.participant.ServiceProvider#${request.user.id}` })
            let registry = await connection.getAssetRegistry('net.wrappy.asset.service.Coupon');
                // let coupons = []
                for (var i = 0; i < result.length; i++) {
                     resultDetail = await registry.resolve(result[i].getIdentifier())
                    // coupons.push(resultDetail)
                     dateStart = new Date(resultDetail.expiryDate)
                     dateEnd = new Date()
                    if( (dateEnd - dateStart) / (1000 * 60 * 60 * 24 ) >=0 ) //coupons that have not been received for more than 24 hours will expire automatically.
                    {
                        const transaction = factory.newTransaction('net.wrappy.transaction.service', 'expireCoupon')
                         transaction.coupon = resultDetail.id
                         await connection.submitTransaction(transaction)
                    }
                }
                await connection.disconnect()

            response.code = 100
            response.description = 'SUCCESS'
            response.data = request.body.coupon

            console.log(response.description)
            console.log('')
        } catch (error) {
            response.code = -100
            response.description = 'FAILED'
            try {
                if (error.message) {
                    const regex = new RegExp("failure: (.*)")
                    const msg = regex.exec(error.message)
                    error = msg[1]
                }
            }
            catch (e) { }
            console.log(error)
            console.log('')
            response.data = error
        }
        return response
    },
    registerUser: async function (request) {
        let response = new Response()
        try {
            const body = JSON.stringify(request.body)
            console.log("Method: registerUser")
            console.log(`Card: ${request.user.id}`)
            console.log(`Parameter: ${body}`)
            console.log('')

            /***** MANDATORY PARAM VALIDATION ******/
            if (!request.body.id) throw "Required field [id] is missing."
            if (!request.body.name) throw "Required field [name] is missing."
            if (!request.body.password) throw "Required field [password] is missing."

            const card = `registryProvider@${network}`
            const connection = new BusinessNetworkConnection()
            const definition = await connection.connect(card)
            const factory = definition.getFactory()
            const id = request.body.id
            const transaction = factory.newTransaction(`net.wrappy.transaction.registry`, `registerUser`)
            transaction.id = id
            transaction.name = request.body.name
            transaction.password = cryptr.encrypt(request.body.password)
            transaction.note = ""

            /*** PROCESS OPTIONAL DATA ***/
            if (request.body.gender) transaction.gender = request.body.gender
            if (request.body.birth) transaction.birth = new Date(request.body.birth)
            if (request.body.nationality) transaction.nationality = request.body.nationality
            if (request.body.contact) {
                const contact = factory.newConcept('net.wrappy.participant.common', 'Contact')
                if (request.body.contact.email) contact.email = request.body.contact.email
                if (request.body.contact.phone) contact.phone = request.body.contact.phone
                if (request.body.contact.mobile) contact.mobile = request.body.contact.mobile
                transaction.contact = contact
            }
            if (request.body.address) {
                const address = factory.newConcept('net.wrappy.participant.common', 'Address')
                address.addressLine1 = request.body.address.addressLine1
                if (request.body.address.addressLine2) address.addressLine2 = request.body.address.addressLine2
                address.city = request.body.address.city
                address.state = request.body.address.state
                address.zip = request.body.address.zip
                address.country = request.body.address.country
                transaction.address = address
            }

            transaction.date = new Date()
            await connection.submitTransaction(transaction)
            await connection.disconnect()

            response.code = 100
            response.description = 'SUCCESS'

            console.log("Issuing identity ...")
            console.log('')
            response.data = await issueIdentity(`net.wrappy.participant.User#${id}`, `${id}@${network}`)
            console.log(response.description)
            console.log('')
        } catch (error) {
            response.code = -100
            response.description = 'FAILED'
            try {
                if (error.message) {
                    const regex = new RegExp("failure: (.*)")
                    const msg = regex.exec(error.message)
                    error = msg[1]
                }
            }
            catch (e) { }
            console.log(error)
            console.log('')
            response.data = error
        }
        return response
    },    
    updateUser: async function (request) {
        let response = new Response()
        try {
            const body = JSON.stringify(request.body)
            console.log("Method: updateUser")
            console.log(`Card: ${request.user.id}`)
            console.log(`Parameter: ${body}`)
            console.log('')

            if (!request.body.user) throw "Required field [user] is missing."

            const card = `registryProvider@${network}`
            const connection = new BusinessNetworkConnection()
            const definition = await connection.connect(card)
            const factory = definition.getFactory()
            const transaction = factory.newTransaction(`net.wrappy.transaction.registry`, `updateUser`)

            const userReference = factory.newRelationship('net.wrappy.participant', 'User', request.body.user)
            transaction.user = userReference
            if (request.body.name) transaction.name = request.body.name
            if (request.body.password) transaction.password = cryptr.encrypt(request.body.password)
            if (request.body.gender) transaction.gender = request.body.gender
            if (request.body.birth) transaction.birth = Date.parse(request.body.birth)
            if (request.body.nationality) transaction.nationality = request.body.nationality
            if (request.body.contact) {
                const contact = factory.newConcept('net.wrappy.participant.common', 'Contact')
                if (request.body.contact.email) contact.email = request.body.contact.email
                if (request.body.contact.phone) contact.phone = request.body.contact.phone
                if (request.body.contact.mobile) contact.mobile = request.body.contact.mobile
                transaction.contact = contact
            }
            if (request.body.address) {
                const address = factory.newConcept('net.wrappy.participant.common', 'Address')
                address.addressLine1 = request.body.address.addressLine1
                if (request.body.address.addressLine2) address.addressLine2 = request.body.address.addressLine2
                address.city = request.body.address.city
                address.state = request.body.address.state
                address.zip = request.body.address.zip
                address.country = request.body.address.country
                transaction.address = address
            }
            await connection.submitTransaction(transaction)
            await connection.disconnect()
            response.code = 100
            response.description = 'SUCCESS'
        } catch (error) {
            response.code = -100
            response.description = 'FAILED'
            try {
                if (error.message) {
                    const regex = new RegExp("failure: (.*)")
                    const msg = regex.exec(error.message)
                    error = msg[1]
                }
            }
            catch (e) { }
            console.log(error)
            console.log('')
            response.data = error
        }
        return response
    },    
    balance: async function (request) {
        let response = new Response()
        try {
            const body = JSON.stringify(request.body)
            console.log("Method: balance")
            console.log(`Card: ${request.user.id}`)
            console.log(`Parameter: ${body}`)
            console.log('')

            const card = `${request.user.id}@${network}`
            const connection = new BusinessNetworkConnection()
            await connection.connect(card)
            const registry = await connection.getParticipantRegistry('net.wrappy.participant.ServiceProvider')
            const serviceProvider = await registry.resolve(request.user.id)
            await connection.disconnect()
            response.code = 100
            response.description = 'SUCCESS'
            response.data = serviceProvider.servicePeer.wallet.balance

            console.log(response.description)
            console.log('')
        } catch (error) {
            response.code = -100
            response.description = 'FAILED'
            try {
                if (error.message) {
                    const regex = new RegExp("failure: (.*)")
                    const msg = regex.exec(error.message)
                    error = msg[1]
                }
            }
            catch (e) { }
            console.log(error)
            console.log('')
            response.data = error
        }
        return response
    },
    transfer: async function (request) {
        let response = new Response()
        try {
            const body = JSON.stringify(request.body)
            console.log("Method: transfer")
            console.log(`Card: ${request.user.id}`)
            console.log(`Parameter: ${body}`)
            console.log('')

            /***** MANDATORY PARAM VALIDATION ******/
            if (!request.body.recipient) throw "Required field [recipient] is missing."
            if (typeof(request.body.amount) !== 'number') throw "Required field [amount] is missing."

            const uniqueID = require('uniqid');
            const uuid = uniqueID.time('ST-').toUpperCase()

            const card = `${request.user.id}@${network}`
            const connection = new BusinessNetworkConnection()
            const definition = await connection.connect(card)
            const factory = definition.getFactory()
            const transaction = factory.newTransaction(`net.wrappy.transaction.service`, `serviceTransfer`)
            let recipientReference = factory.newRelationship('net.wrappy.participant', 'User', request.body.recipient)
            transaction.id = uuid
            transaction.amount = request.body.amount
            transaction.recipient = recipientReference
            transaction.note = ""
            transaction.date = new Date()
            await connection.submitTransaction(transaction)
            await connection.disconnect()

            response.code = 100
            response.description = 'SUCCESS'
            response.data = uuid
            console.log(response.description)
            console.log('')
        } catch (error) {
            response.code = -100
            response.description = 'FAILED'
            try {
                if (error.message) {
                    const regex = new RegExp("failure: (.*)")
                    const msg = regex.exec(error.message)
                    error = msg[1]
                }
            }
            catch (e) { }
            console.log(error)
            console.log('')
            response.data = error
        }
        return response
    },
    purchaseCredit: async function (request) {
        let response = new Response()
        try {
            const body = JSON.stringify(request.body)
            console.log("Method: purchaseCredit")
            console.log(`Card: ${request.user.id}`)
            console.log(`Parameter: ${body}`)
            console.log('')

            /***** MANDATORY PARAM VALIDATION ******/
            if (typeof(request.body.amount) !== 'number') throw "Required field [amount] is missing."
            if (!request.body.finPeer) throw "Required field [finPeer] is missing."

            const uniqueID = require('uniqid');
            const uuid = uniqueID.time('CP-').toUpperCase()

            const card = `${request.user.id}@${network}`
            const connection = new BusinessNetworkConnection()
            const definition = await connection.connect(card)
            const factory = definition.getFactory()
            const transaction = factory.newTransaction(`net.wrappy.transaction.service`, `registerCreditPurchase`)
            const finPeerReference = factory.newRelationship('net.wrappy.asset.fin', 'FinPeer', request.body.finPeer)
            transaction.id = uuid
            transaction.amount = request.body.amount
            transaction.finPeer = finPeerReference
            transaction.note = ""
            transaction.date = new Date()
            await connection.submitTransaction(transaction)
            await connection.disconnect()

            response.code = 100
            response.description = 'SUCCESS'
            response.data = uuid
            console.log(response.description)
            console.log('')
        } catch (error) {
            response.code = -100
            response.description = 'FAILED'
            try {
                if (error.message) {
                    const regex = new RegExp("failure: (.*)")
                    const msg = regex.exec(error.message)
                    error = msg[1]
                }
            }
            catch (e) { }
            console.log(error)
            console.log('')
            response.data = error
        }
        return response
    },
    cancelCredit: async function (request) {
        let response = new Response()
        try {
            const body = JSON.stringify(request.body)
            console.log("Method: cancelCredit")
            console.log(`Card: ${request.user.id}`)
            console.log(`Parameter: ${body}`)
            console.log('')

            /***** MANDATORY PARAM VALIDATION ******/
            if (!request.body.purchase) throw "Required field [purchase] is missing."

            const card = `${request.user.id}@${network}`
            const connection = new BusinessNetworkConnection()
            const definition = await connection.connect(card)
            const factory = definition.getFactory()
            const transaction = factory.newTransaction('net.wrappy.transaction.service', 'cancelCreditPurchase')
            const purchaseReference = factory.newRelationship('net.wrappy.asset.service', 'CreditPurchase', request.body.purchase)
            transaction.purchase = purchaseReference
            await connection.submitTransaction(transaction)
            await connection.disconnect()

            response.code = 100
            response.description = 'SUCCESS'
            response.data = request.body.purchase

            console.log(response.description)
            console.log('')
        } catch (error) {
            response.code = -100
            response.description = 'FAILED'
            try {
                if (error.message) {
                    const regex = new RegExp("failure: (.*)")
                    const msg = regex.exec(error.message)
                    error = msg[1]
                }
            }
            catch (e) { }
            console.log(error)
            console.log('')
            response.data = error
        }
        return response
    },
    listBank: async function (request) {
        let response = new Response()
        try {
            const body = JSON.stringify(request.body)
            console.log("Method: listBank")
            console.log(`Card: ${request.user.id}`)
            console.log(`Parameter: ${body}`)
            console.log('')

            const card = `${request.user.id}@${network}`
            const connection = new BusinessNetworkConnection()
            await connection.connect(card)
            const query = connection.buildQuery(`SELECT net.wrappy.asset.fin.FinPeer`)
            const result = await connection.query(query)
            if (result.length == 0) throw "NOTICE: No data found."
            else {
                let banks = []
                result.forEach(bank => {
                    banks.push({
                       id: bank.id,
                       name: bank.name 
                    })
                  })
                response.code = 100
                response.description = 'SUCCESS'
                response.data = banks
            }
            await connection.disconnect()
            response.code = 100
            response.description = 'SUCCESS'
            console.log(response.description)
            console.log('')
        } catch (error) {
            response.code = -100
            response.description = 'FAILED'
            try {
                if (error.message) {
                    const regex = new RegExp("failure: (.*)")
                    const msg = regex.exec(error.message)
                    error = msg[1]
                }
            }
            catch (e) { }
            console.log(error)
            console.log('')
            response.data = error
        }
        return response
    },
    listCredit: async function (request) {
        let response = new Response()
        try {
            const body = JSON.stringify(request.body)
            console.log("Method: listCredit")
            console.log(`Card: ${request.user.id}`)
            console.log(`Parameter: ${body}`)
            console.log('')

            const card = `${request.user.id}@${network}`
            const connection = new BusinessNetworkConnection()
            await connection.connect(card)
            const query = connection.buildQuery(`SELECT net.wrappy.asset.service.CreditPurchase WHERE (owner == _$owner)`)
            const result = await connection.query(query, { owner: `resource:net.wrappy.participant.ServiceProvider#${request.user.id}` })
            if (result.length == 0) throw "NOTICE: No data found."
            else {
                let credits = []
                result.forEach(credit => {
                    credits.push({
                       id: credit.id,
                       date: credit.date,
                       amount: credit.amount,
                       status: credit.status,
                       bank: credit.finPeer.getIdentifier()
                    })
                  })
                response.data = credits
            }
            await connection.disconnect()
            response.code = 100
            response.description = 'SUCCESS'
            console.log(response.description)
            console.log('')
        } catch (error) {
            response.code = -100
            response.description = 'FAILED'
            try {
                if (error.message) {
                    const regex = new RegExp("failure: (.*)")
                    const msg = regex.exec(error.message)
                    error = msg[1]
                }
            }
            catch (e) { }
            console.log(error)
            console.log('')
            response.data = error
        }
        return response
    },
    listProteusionTransfer: async function (request) {
        let response = new Response()
        try {
            const body = JSON.stringify(request.body)
            console.log("Method: listProteusionTransfer")
            console.log(`Card: ${request.user.id}`)
            console.log(`Parameter: ${body}`)
            console.log('')

            const card = `${request.user.id}@${network}`
            const connection = new BusinessNetworkConnection()
            await connection.connect(card)
            const query = connection.buildQuery(`SELECT net.wrappy.asset.service.ServiceTransfer WHERE (owner == _$owner)`)
            const result = await connection.query(query, { owner: `resource:net.wrappy.participant.ServiceProvider#${request.user.id}` })
            if (result.length == 0) throw "NOTICE: No data found."
            else {
                let transfers = []
                result.forEach(transfer => {
                    transfers.push({
                       id: transfer.id,
                       recipient: transfer.recipient.getIdentifier(),
                       date: transfer.date,
                       amount: transfer.amount,
                       note: transfer.note
                    })
                  })
                response.code = 100
                response.description = 'SUCCESS'
                response.data = transfers
            }
            await connection.disconnect()
            response.code = 100
            response.description = 'SUCCESS'
            console.log(response.description)
            console.log('')
        } catch (error) {
            response.code = -100
            response.description = 'FAILED'
            try {
                if (error.message) {
                    const regex = new RegExp("failure: (.*)")
                    const msg = regex.exec(error.message)
                    error = msg[1]
                }
            }
            catch (e) { }
            console.log(error)
            console.log('')
            response.data = error
        }
        return response
    },
    listTokenTransfer: async function (request) {
        let response = new Response()
        try {
            const body = JSON.stringify(request.body)
            console.log("Method: listTokenTransfer")
            console.log(`Card: ${request.user.id}`)
            console.log(`Parameter: ${body}`)
            console.log('')

            const card = `${request.user.id}@${network}`
            const connection = new BusinessNetworkConnection()
            await connection.connect(card)
            const query = connection.buildQuery(`SELECT net.wrappy.asset.service.ServiceTokenTransfer WHERE (owner == _$owner)`)
            const result = await connection.query(query, { owner: `resource:net.wrappy.participant.ServiceProvider#${request.user.id}` })
            if (result.length == 0) throw "NOTICE: No data found."
            else {
                let transfers = []
                result.forEach(transfer => {
                    transfers.push({
                       id: transfer.id,
                       recipient: transfer.recipient.getIdentifier(),
                       date: transfer.date,
                       amount: transfer.amount,
                       note: transfer.note
                    })
                  })
                response.code = 100
                response.description = 'SUCCESS'
                response.data = transfers
            }
            await connection.disconnect()
            response.code = 100
            response.description = 'SUCCESS'
            console.log(response.description)
            console.log('')
        } catch (error) {
            response.code = -100
            response.description = 'FAILED'
            try {
                if (error.message) {
                    const regex = new RegExp("failure: (.*)")
                    const msg = regex.exec(error.message)
                    error = msg[1]
                }
            }
            catch (e) { }
            console.log(error)
            console.log('')
            response.data = error
        }
        return response
    },
    listServiceMint: async function (request) {
        let response = new Response()
        try {
            const body = JSON.stringify(request.body)
            console.log("Method: listTokenTransfer")
            console.log(`Card: ${request.user.id}`)
            console.log(`Parameter: ${body}`)
            console.log('')

            const card = `${request.user.id}@${network}`
            const connection = new BusinessNetworkConnection()
            await connection.connect(card)
            const query = connection.buildQuery(`SELECT net.wrappy.asset.service.ServiceMint WHERE (owner == _$owner)`)
            const result = await connection.query(query, { owner: `resource:net.wrappy.participant.ServiceProvider#${request.user.id}` })
            if (result.length == 0) throw "NOTICE: No data found."
            else {
                let mints = []
                result.forEach(mint => {
                    mints.push({
                       id: mint.id,
                       date: mint.date,
                       amount: mint.amount,
                       status: mint.status
                    })
                  })
                response.code = 100
                response.description = 'SUCCESS'
                response.data = mints
            }
            await connection.disconnect()
            response.code = 100
            response.description = 'SUCCESS'
            console.log(response.description)
            console.log('')
        } catch (error) {
            response.code = -100
            response.description = 'FAILED'
            try {
                if (error.message) {
                    const regex = new RegExp("failure: (.*)")
                    const msg = regex.exec(error.message)
                    error = msg[1]
                }
            }
            catch (e) { }
            console.log(error)
            console.log('')
            response.data = error
        }
        return response
    },
    serviceTokenTransfer: async function (request) {
        let response = new Response()
        try {
            const body = JSON.stringify(request.body)
            console.log("Method: serviceTokenTransfer")
            console.log(`Card: ${request.user.id}`)
            console.log(`Parameter: ${body}`)
            console.log('')

            /***** MANDATORY PARAM VALIDATION ******/
            if (!request.body.recipient) throw "Required field [recipient] is missing."
            if (typeof(request.body.amount) !== 'number') throw "Required field [amount] is missing."

            const uniqueID = require('uniqid');
            const uuid = uniqueID.time('ST-').toUpperCase()

            const card = `${request.user.id}@${network}`
            const connection = new BusinessNetworkConnection()
            const definition = await connection.connect(card)
            const factory = definition.getFactory()
            const transaction = factory.newTransaction(`net.wrappy.transaction.service`, `serviceTokenTransfer`)
            let recipientReference = factory.newRelationship('net.wrappy.participant', 'User', request.body.recipient)
            transaction.id = uuid
            transaction.amount = request.body.amount
            transaction.recipient = recipientReference
            transaction.note = ""
            transaction.date = new Date()
            await connection.submitTransaction(transaction)
            await connection.disconnect()

            response.code = 100
            response.description = 'SUCCESS'
            response.data = uuid
            console.log(response.description)
            console.log('')
        } catch (error) {
            response.code = -100
            response.description = 'FAILED'
            try {
                if (error.message) {
                    const regex = new RegExp("failure: (.*)")
                    const msg = regex.exec(error.message)
                    error = msg[1]
                }
            }
            catch (e) { }
            console.log(error)
            console.log('')
            response.data = error
        }
        return response
    },
    registerServiceToken: async function (request) {
        let response = new Response()
        try {
            const body = JSON.stringify(request.body)
            console.log("Method: registerServiceToken")
            console.log(`Card: ${request.user.id}`)
            console.log(`Parameter: ${body}`)
            console.log('')

            /***** MANDATORY PARAM VALIDATION ******/
            if (!request.body.name) throw "Required field [name] is missing."
            if (!request.body.symbol) throw "Required field [symbol] is missing."
            if (typeof(request.body.decimal) !== 'number') throw "Required field [decimal] is missing."
            if (typeof(request.body.transferrable) !== 'boolean') throw "Required field [transferrable] is missing."

            const card = `${request.user.id}@${network}`
            const connection = new BusinessNetworkConnection()
            const definition = await connection.connect(card)
            const factory = definition.getFactory()
            const transaction = factory.newTransaction(`net.wrappy.transaction.service`, `registerServiceToken`)
            transaction.id = request.body.symbol
            transaction.name = request.body.name
            transaction.symbol = request.body.symbol
            transaction.decimal = request.body.decimal
            transaction.transferrable = request.body.transferrable
            transaction.date = new Date()
            await connection.submitTransaction(transaction)
            await connection.disconnect()

            response.code = 100
            response.description = 'SUCCESS'
            response.data = request.body.symbol
            console.log(response.description)
            console.log('')
        } catch (error) {
            response.code = -100
            response.description = 'FAILED'
            try {
                if (error.message) {
                    const regex = new RegExp("failure: (.*)")
                    const msg = regex.exec(error.message)
                    error = msg[1]
                }
            }
            catch (e) { }
            console.log(error)
            console.log('')
            response.data = error
        }
        return response
    },
    registerServiceMint: async function (request) {
        let response = new Response()
        try {
            const body = JSON.stringify(request.body)
            console.log("Method: registerServiceMint")
            console.log(`Card: ${request.user.id}`)
            console.log(`Parameter: ${body}`)
            console.log('')

            /***** MANDATORY PARAM VALIDATION ******/
            if (typeof(request.body.amount) !== 'number') throw "Required field [amount] is missing."

            const uniqueID = require('uniqid');
            const uuid = uniqueID.time('SM-').toUpperCase()

            const card = `${request.user.id}@${network}`
            const connection = new BusinessNetworkConnection()
            const definition = await connection.connect(card)
            const factory = definition.getFactory()
            const transaction = factory.newTransaction(`net.wrappy.transaction.service`, `registerServiceMint`)
            transaction.id = uuid
            transaction.amount = request.body.amount
            transaction.note = ""
            transaction.date = new Date()
            await connection.submitTransaction(transaction)
            await connection.disconnect()

            response.code = 100
            response.description = 'SUCCESS'
            response.data = uuid
            console.log(response.description)
            console.log('')
        } catch (error) {
            response.code = -100
            response.description = 'FAILED'
            try {
                if (error.message) {
                    const regex = new RegExp("failure: (.*)")
                    const msg = regex.exec(error.message)
                    error = msg[1]
                }
            }
            catch (e) { }
            console.log(error)
            console.log('')
            response.data = error
        }
        return response
    },
    cancelServiceMint: async function (request) {
        let response = new Response()
        try {
            const body = JSON.stringify(request.body)
            console.log("Method: cancelCreditPurchase")
            console.log(`Card: ${request.user.id}`)
            console.log(`Parameter: ${body}`)
            console.log('')

            /***** MANDATORY PARAM VALIDATION ******/
            if (!request.body.mint) throw "Required field [mint] is missing."

            const card = `${request.user.id}@${network}`
            const connection = new BusinessNetworkConnection()
            const definition = await connection.connect(card)
            const factory = definition.getFactory()
            const transaction = factory.newTransaction('net.wrappy.transaction.service', 'cancelServiceMint')
            const mintReference = factory.newRelationship('net.wrappy.asset.service', 'ServiceMint', request.body.mint)
            transaction.mint = mintReference
            await connection.submitTransaction(transaction)
            await connection.disconnect()

            response.code = 100
            response.description = 'SUCCESS'
            response.data = request.body.mint

            console.log(response.description)
            console.log('')
        } catch (error) {
            response.code = -100
            response.description = 'FAILED'
            try {
                if (error.message) {
                    const regex = new RegExp("failure: (.*)")
                    const msg = regex.exec(error.message)
                    error = msg[1]
                }
            }
            catch (e) { }
            console.log(error)
            console.log('')
            response.data = error
        }
        return response
    },
    approveServiceMint: async function (request) {
        let response = new Response()
        try {
            const body = JSON.stringify(request.body)
            console.log("Method: approveServiceMint")
            console.log(`Card: ${request.user.id}`)
            console.log(`Parameter: ${body}`)
            console.log('')

            /***** MANDATORY PARAM VALIDATION ******/
            if (!request.body.mint) throw "Required field [mint] is missing."

            const card = `${request.user.id}@${network}`
            const connection = new BusinessNetworkConnection()
            const definition = await connection.connect(card)
            const factory = definition.getFactory()
            const transaction = factory.newTransaction('net.wrappy.transaction.service.approver', 'approveServiceMint')
            const mintReference = factory.newRelationship('net.wrappy.asset.service', 'ServiceMint', request.body.mint)
            transaction.mint = mintReference
            await connection.submitTransaction(transaction)
            await connection.disconnect()

            response.code = 100
            response.description = 'SUCCESS'
            response.data = request.body.mint

            console.log(response.description)
            console.log('')
        } catch (error) {
            response.code = -100
            response.description = 'FAILED'
            try {
                if (error.message) {
                    const regex = new RegExp("failure: (.*)")
                    const msg = regex.exec(error.message)
                    error = msg[1]
                }
            }
            catch (e) { }
            console.log(error)
            console.log('')
            response.data = error
        }
        return response
    },
    rejectServiceMint: async function (request) {
        let response = new Response()
        try {
            const body = JSON.stringify(request.body)
            console.log("Method: rejectServiceMint")
            console.log(`Card: ${request.user.id}`)
            console.log(`Parameter: ${body}`)
            console.log('')

            /***** MANDATORY PARAM VALIDATION ******/
            if (!request.body.mint) throw "Required field [mint] is missing."

            const card = `${request.user.id}@${network}`
            const connection = new BusinessNetworkConnection()
            const definition = await connection.connect(card)
            const factory = definition.getFactory()
            const transaction = factory.newTransaction('net.wrappy.transaction.service.approver', 'rejectServiceMint')
            const mintReference = factory.newRelationship('net.wrappy.asset.service', 'ServiceMint', request.body.mint)
            transaction.mint = mintReference
            await connection.submitTransaction(transaction)
            await connection.disconnect()

            response.code = 100
            response.description = 'SUCCESS'
            response.data = request.body.mint

            console.log(response.description)
            console.log('')
        } catch (error) {
            response.code = -100
            response.description = 'FAILED'
            try {
                if (error.message) {
                    const regex = new RegExp("failure: (.*)")
                    const msg = regex.exec(error.message)
                    error = msg[1]
                }
            }
            catch (e) { }
            console.log(error)
            console.log('')
            response.data = error
        }
        return response
    },
    setServiceConfig: async function (request) {
        let response = new Response()
        try {
            const body = JSON.stringify(request.body)
            console.log("Method: setServiceConfig")
            console.log(`Card: ${request.user.id}`)
            console.log(`Parameter: ${body}`)
            console.log('')

            /***** MANDATORY PARAM VALIDATION ******/
            if (typeof(request.body.transferrable) !== 'boolean') throw "Required field [transferrable] is missing."

            const card = `${request.user.id}@${network}`
            const connection = new BusinessNetworkConnection()
            const definition = await connection.connect(card)
            const factory = definition.getFactory()
            const transaction = factory.newTransaction('net.wrappy.transaction.service', 'setServiceConfig')
            transaction.transferrable = request.body.transferrable
            await connection.submitTransaction(transaction)
            await connection.disconnect()

            response.code = 100
            response.description = 'SUCCESS'
            response.data = `transferrable = ${request.body.transferrable}`

            console.log(response.description)
            console.log('')
        } catch (error) {
            response.code = -100
            response.description = 'FAILED'
            try {
                if (error.message) {
                    const regex = new RegExp("failure: (.*)")
                    const msg = regex.exec(error.message)
                    error = msg[1]
                }
            }
            catch (e) { }
            console.log(error)
            console.log('')
            response.data = error
        }
        return response
    }
}