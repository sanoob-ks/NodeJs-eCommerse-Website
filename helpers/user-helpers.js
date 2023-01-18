const db = require('../config/connection')
const collection = require('../config/collection.js')
const bcrypt = require('bcrypt')
const { resolve } = require('express-hbs/lib/resolver')
const { ObjectId } = require('mongodb')
const { response } = require('../app')
const { PRODUCT_COLLECTION } = require('../config/collection.js')
const Razorpay = require('razorpay');
var instance = new Razorpay({
    key_id: 'rzp_test_gBpZ2WthVa6324',
    key_secret: '6W6EKdvX1biqvMV02MhUn69x',
});


module.exports = {
    doSignup: (userData) => {
        return new Promise(async (resolve, reject) => {
            userData.password = await bcrypt.hash(userData.password, 10)
            db.get().collection(collection.USER_COLLECTION).insertOne(userData).then((response) => {
                resolve(response)
            })
        })

    },
    doLogin: (userData) => {
        return new Promise(async (resolve, reject) => {
            let user = await db.get().collection(collection.USER_COLLECTION).findOne({ email: userData.email })
            let loginStatus = false
            let response = {}
            if (user) {
                bcrypt.compare(userData.password, user.password).then((status) => {
                    if (status) {
                        response.status = true
                        response.user = user
                        resolve(response)
                    } else {
                        resolve({ status: false })
                    }
                })
            } else {
                resolve({ status: false })
            }
        })
    },
    addToCart: (proId, userId) => {
        let proObj = {
            item: ObjectId(proId),
            quantity: 1
        }
        return new Promise(async (resolve, reject) => {
            let userCart = await db.get().collection(collection.CART_COLLLECTION).findOne({ user: ObjectId(userId) })
            if (userCart) {
                let proExist = await userCart.products.findIndex(product => product.item == proId)//await?
                if (proExist != -1) {
                    db.get().collection(collection.CART_COLLLECTION)
                        .updateOne({ user: ObjectId(userId), 'products.item': ObjectId(proId) }, {
                            $inc: { 'products.$.quantity': 1 }
                        }).then((response) => {
                            resolve()
                        })
                } else {
                    db.get().collection(collection.CART_COLLLECTION)
                        .updateOne({ user: ObjectId(userId) }, {
                            $push: { products: proObj }
                        }).then((response) => {
                            resolve()
                        })
                }
            } else {
                let cartObj = {
                    user: ObjectId(userId),
                    products: [proObj]
                }

                db.get().collection(collection.CART_COLLLECTION).insertOne(cartObj).then((response) => {
                    resolve()
                })
            }
        })
    },
    getCartProduct: (userId) => {
        return new Promise(async (resolve, reject) => {
            cart = await db.get().collection(collection.CART_COLLLECTION).findOne({ user: ObjectId(userId) })
            if (cart) {
                let cartItems = await db.get().collection(collection.CART_COLLLECTION).aggregate([
                    {
                        $match: { user: ObjectId(userId) }
                    },
                    {
                        $unwind: '$products'
                    },
                    {
                        $project: {
                            item: '$products.item',
                            quantity: '$products.quantity'
                        }
                    }, {
                        $lookup: {
                            from: collection.PRODUCT_COLLECTION,
                            localField: 'item',
                            foreignField: '_id',
                            as: 'product'

                        }
                    }, {
                        $project: {
                            item: 1, quantity: 1, product: { $arrayElemAt: ['$product', 0] }
                        }
                    }
                ]).toArray()
                resolve(cartItems)
            } else {
                resolve(false)
            }
        })
    },
    getCartCount: (userId) => {
        let count = 0
        return new Promise(async (resolve, reject) => {
            let cart = await db.get().collection(collection.CART_COLLLECTION).findOne({ user: ObjectId(userId) })
            if (cart) {
                count = cart.products.length
            }
            resolve(count)
        })
    },
    changeProductQuantity: (proDetails) => {
        return new Promise((resolve, reject) => {
            proDetails.quantity = parseInt(proDetails.quantity)
            proDetails.count = parseInt(proDetails.count)
            if (proDetails.count === -1 && proDetails.quantity === 1) {
                db.get().collection(collection.CART_COLLLECTION)
                    .updateOne({ _id: ObjectId(proDetails.cart) }, {
                        $pull: { products: { item: ObjectId(proDetails.product) } }
                    }).then((response) => {
                        resolve({ removeProduct: true })
                    })
            } else {
                db.get().collection(collection.CART_COLLLECTION)
                    .updateOne({ _id: ObjectId(proDetails.cart), 'products.item': ObjectId(proDetails.product) }, {
                        $inc: { 'products.$.quantity': proDetails.count }
                    }).then((response) => {
                        resolve(response)
                    })
            }

        })
    },
    removeCartProduct: (proDetails) => {
        return new Promise((resolve, reject) => {
            db.get().collection(collection.CART_COLLLECTION)
                .updateOne({ _id: ObjectId(proDetails.cart) }, {
                    $pull: { products: { item: ObjectId(proDetails.product) } }
                }).then((response) => {
                    resolve(true)
                })
        })
    },
    getTotalAmount: async (userId) => {
        return new Promise(async (resolve, reject) => {
            cart = await db.get().collection(collection.CART_COLLLECTION).findOne({ user: ObjectId(userId) })
            if (cart) {
                let total = await db.get().collection(collection.CART_COLLLECTION).aggregate([
                    {
                        $match: { user: ObjectId(userId) }
                    },
                    {
                        $unwind: '$products'
                    },
                    {
                        $project: {
                            item: '$products.item',
                            quantity: '$products.quantity'
                        }
                    }, {
                        $lookup: {
                            from: collection.PRODUCT_COLLECTION,
                            localField: 'item',
                            foreignField: '_id',
                            as: 'product'

                        }
                    }, {
                        $project: {
                            item: 1, quantity: 1, product: { $arrayElemAt: ['$product', 0] }
                        }
                    }, {
                        $group: {
                            _id: null,
                            total: { $sum: { $multiply: ['$quantity', '$product.Price'] } }
                        }
                    }
                ]).toArray()
                resolve(total[0].total)
            } else {
                resolve(0)
            }
        })
    },
    getCartProductList: (userId) => {
        return new Promise(async (resolve, reject) => {
            let cart = await db.get().collection(collection.CART_COLLLECTION).findOne({ user: ObjectId(userId) })
            resolve(cart.products)
        })
    },
    placeOrder: (orderDetails, products, total) => {
        return new Promise((resolve, reject) => {
            let status = orderDetails['payment-method'] === 'COD' ? 'placed' : 'pending'
            let orderObj = {
                delivery: {
                    mobile: orderDetails.mobile,
                    address: orderDetails.address,
                    pincode: orderDetails.pincode
                },
                products: products,
                status: status,
                totalAmount: total,
                userId: ObjectId(orderDetails.userId),
                paymentMethod: orderDetails['payment-method'],
                date: new Date().toLocaleDateString()
            }
            db.get().collection(collection.ORDER_COLLECTION).insertOne(orderObj).then((response) => {
                db.get().collection(collection.CART_COLLLECTION).deleteOne({ user: (ObjectId(orderDetails.userId)) })
                resolve(response)
            })
        })
    },
    getUserOrders: (userId) => {
        return new Promise(async (resolve, reject) => {
            let orders = await db.get().collection(collection.ORDER_COLLECTION).find({ userId: ObjectId(userId) }).toArray()
            resolve(orders)
            //console.log(orders)
        })
    },
    getOrderProduct: (orderId) => {
        return new Promise(async (resolve, reject) => {
            let orderItems = await db.get().collection(collection.ORDER_COLLECTION).aggregate([
                {
                    $match: { _id: ObjectId(orderId) }
                },
                {
                    $unwind: '$products'
                },
                {
                    $project: {
                        item: '$products.item',
                        quantity: '$products.quantity'
                    }
                }, {
                    $lookup: {
                        from: collection.PRODUCT_COLLECTION,
                        localField: 'item',
                        foreignField: '_id',
                        as: 'product'

                    }
                }, {
                    $project: {
                        item: 1, quantity: 1, product: { $arrayElemAt: ['$product', 0] }
                    }
                }
            ]).toArray()
            //console.log(orderItems)
            resolve(orderItems)
        })
    },
    generateRazorpay: (orderId, total) => {
        return new Promise((resolve, reject) => {
            var options = {
                amount: total*100,  // amount in the smallest currency unit
                currency: "INR",
                receipt: "" + orderId
            };
            instance.orders.create(options, function (err, order) {
                resolve(order);
            });
        })
    },
    varifyPayment: (details) => {
        return new Promise((resolve, reject) => {
            let body = details['payment[razorpay_order_id]'] + "|" + details['payment[razorpay_payment_id]'];

            const crypto = require("crypto");
            var expectedSignature = crypto.createHmac('sha256', '6W6EKdvX1biqvMV02MhUn69x')
                .update(body.toString())
                .digest('hex');
            if (expectedSignature === details['payment[razorpay_signature]']) {
                resolve()
            }else{
                reject()
            }
            
        })
    },
    changePaymentStatus:(orderId)=>{
        return new Promise((resolve,reject)=>{
        db.get().collection(collection.ORDER_COLLECTION)
        .updateOne({_id:ObjectId(orderId)},{
            $set:{
                status:'placed'
            }
        }).then(()=>{
            resolve()
        })
        })
    }

}

