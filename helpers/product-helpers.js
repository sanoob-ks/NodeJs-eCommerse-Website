var db=require('../config/connection')
var collection=require('../config/collection.js')
const { response } = require('../app')
var objectId=require('mongodb').ObjectId

module.exports={
    addProduct:function(product,callback){
        console.log(product)
        product.Price=parseInt(product.Price)
        db.get().collection(collection.PRODUCT_COLLECTION).insertOne(product).then((data) =>{
            //console.log(data)
            callback(data.insertedId)
        })
    },
    getAllProduct:(callback) => {
        return new Promise(async(resolve,reject)=>{
           let products=await db.get().collection(collection.PRODUCT_COLLECTION).find().toArray()
           resolve(products)
        })
    },
    deleteProduct:(proId)=>{
        return new Promise((resolve,reject)=>{
            db.get().collection(collection.PRODUCT_COLLECTION).deleteOne({_id:objectId(proId)}).then((response)=>{
                resolve(response)
            })

        })
    },
    getProductDetails:(proId)=>{
        return new Promise((resolve,reject)=>{
            db.get().collection(collection.PRODUCT_COLLECTION).findOne({_id:objectId(proId)}).then((proDetails)=>{
                resolve(proDetails)
            })

        })  
    },
    updateProduct:(proId,data)=>{
        return new Promise((resolve,reject)=>{
            db.get().collection(collection.PRODUCT_COLLECTION).updateOne({_id:objectId(proId)},{
               $set:{
                Name:data.Name,
                Category:data.Category,
                Price:data.Price,
                Description:data.Description
               } 
            }).then((response)=>{
                resolve(response)
            })

        })
        
    }

}