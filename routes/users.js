const { response } = require('express');
var express = require('express');
var router = express.Router();
var productHelpers=require('../helpers/product-helpers')
const userHelpers=require('../helpers/user-helpers')
const varifyLogin=(req,res,next)=>{
  if(req.session.loggedIn){
    next()
  }else{
    res.redirect('/login')
  }
    
};


/* GET home page. */
router.get('/',async function(req, res, next) {
  let user=req.session.user
  let cartCount=null
  if(user){
    cartCount= await userHelpers.getCartCount(user._id)
  }
  productHelpers.getAllProduct().then((products) => {
    
    res.render('user/index',{admin:false,products,user,cartCount})

  })
});
router.get('/login',(req,res) => {
  if(req.session.loggedIn){
    res.redirect('/')
  }else{

    res.render('user/login',{loginErr:req.session.loginErr})
    req.session.loginErr=false
  }
});
router.get('/signup',(req,res) => {
  res.render('user/signup')
});
router.post('/signup',(req,res) =>{
  userHelpers.doSignup(req.body).then((response)=>{
    req.session.loggedIn=true
    req.session.user=response
    res.redirect('/')
  })

});
router.post('/login',(req,res) =>{
  userHelpers.doLogin(req.body).then((response) =>{
    if(response.status){
      req.session.loggedIn=true
      req.session.user=response.user
      res.redirect('/')
    }else{
      req.session.loginErr='Invalid Email or Password'
      res.redirect('/login')
    }
  })


});
router.get('/logout',(req,res) =>{
  req.session.destroy()
  res.redirect('/')
});
router.get('/cart',varifyLogin,async(req,res) =>{
  let user=req.session.user
  let products=await userHelpers.getCartProduct(req.session.user._id)
  let total=await userHelpers.getTotalAmount(req.session.user._id)
  if(products)  res.render('user/cart',{products,user,total})
  else res.render('user/cart-empty',{user})
  
});
router.get('/add-to-cart/:id',(req,res)=>{
  let proId=req.params.id
  let userId=req.session.user._id
  userHelpers.addToCart(proId,userId).then(()=>{
    res.json({status:true})
  })
});
router.post('/change-product-quantity',varifyLogin,(req,res)=>{
  userHelpers.changeProductQuantity(req.body).then(async(response)=>{
    response.total=await userHelpers.getTotalAmount(req.session.user._id)
    res.json(response) //json for ajax no need html render
  })
});

router.post('/remove-cart-product',varifyLogin,(req,res)=>{
  userHelpers.removeCartProduct(req.body).then((response)=>{
    res.json(response)
  })
});

router.get('/place-order',varifyLogin, async(req,res)=>{
  let total=await userHelpers.getTotalAmount(req.session.user._id)
  res.render('user/place-order',{total,user:req.session.user})
});

router.post('/place-order',varifyLogin,async(req,res)=>{
  let products=await userHelpers.getCartProductList(req.body.userId)
  let total=await userHelpers.getTotalAmount(req.body.userId)
  userHelpers.placeOrder(req.body,products,total).then((response)=>{
    if(req.body['payment-method']=='COD'){
      res.json({codStatus:true})
    }else{
      userHelpers.generateRazorpay(response.insertedId,total).then((order)=>{

        res.json(order)
      })
    }
    
  })
});

router.get('/order-success',varifyLogin,(req,res)=>{
  res.render('user/order-success',{user:req.session.user}) 
});
 
router.get('/order' ,varifyLogin, async(req,res)=>{
  let orders=await userHelpers.getUserOrders(req.session.user._id) 
  //console.log(orders)
  res.render('user/order',{orders,address:orders[0].delivery,user:req.session.user})  
});

router.get('/view-order-products/:id',async(req,res)=>{
  let products=await userHelpers.getOrderProduct(req.params.id)
  res.render('user/view-order-products',{products,user:req.session.user})
});

router.post('/varify-payment',(req,res)=>{
  console.log("haaaaaaaaaaaaaaaaaaaaaaaaa")
    userHelpers.varifyPayment(req.body).then(()=>{
      userHelpers.changePaymentStatus(req.body['order[receipt]']).then(()=>{
        res.json({status:true})
      })
    }).catch((err)=>{
      console.log(err)
      res.json({status:false,errMsg:'Payment failed'})
      
    })
})

 
module.exports = router;  
