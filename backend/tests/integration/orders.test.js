import request from 'supertest';
import { createTestApp } from '../test-app.js';
import {
  createTestUser,
  generateToken,
  createTestProduct,
  createTestSku,
  addToCart,
  clearCart,
  createTestPromotion,
  addProductToPromotion,
  createTestCoupon,
  giveCouponToUser,
  getProductStock,
  getUserCouponStatus,
  getCouponUsedCount
} from '../test-helpers.js';
import { cleanAllTables } from '../setup.js';
import { runQuery } from '../../database.js';

const app = createTestApp();

describe('订单创建 API 集成测试', () => {
  let testUser;
  let authToken;

  beforeEach(async () => {
    await cleanAllTables();
    testUser = await createTestUser();
    authToken = `Bearer ${generateToken(testUser.id)}`;
  });

  describe('POST /api/orders/create - 正常创建订单', () => {
    test('应成功创建包含单个商品的订单', async () => {
      const product = await createTestProduct({ name: '测试手机', price: 2999, stock: 50 });
      await addToCart(testUser.id, product.id, 1);

      const response = await request(app.callback())
        .post('/api/orders/create')
        .set('Authorization', authToken)
        .send({
          shipping_address: '北京市朝阳区测试街道123号',
          payment_method: 'cod',
          remark: '测试订单备注'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('订单创建成功');
      expect(response.body.data).toBeDefined();
      expect(response.body.data.order_no).toMatch(/^ORD\d+/);
      expect(response.body.data.total_amount).toBe(2999);
      expect(response.body.data.status).toBe('pending');
      expect(response.body.data.shipping_address).toBe('北京市朝阳区测试街道123号');
      expect(response.body.data.payment_method).toBe('cod');
      expect(response.body.data.remark).toBe('测试订单备注');
      expect(response.body.data.items.length).toBe(1);
      expect(String(response.body.data.items[0].product_id)).toBe(String(product.id));
      expect(response.body.data.items[0].quantity).toBe(1);
      expect(response.body.data.items[0].product_price).toBe(2999);

      const remainingStock = await getProductStock(product.id);
      expect(remainingStock).toBe(49);
    });

    test('应成功创建包含多个商品的订单', async () => {
      const product1 = await createTestProduct({ name: '商品A', price: 100, stock: 10 });
      const product2 = await createTestProduct({ name: '商品B', price: 200, stock: 20 });
      await addToCart(testUser.id, product1.id, 2);
      await addToCart(testUser.id, product2.id, 1);

      const response = await request(app.callback())
        .post('/api/orders/create')
        .set('Authorization', authToken)
        .send({
          shipping_address: '上海市浦东新区测试路456号'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.total_amount).toBe(400);
      expect(response.body.data.items.length).toBe(2);

      const stock1 = await getProductStock(product1.id);
      const stock2 = await getProductStock(product2.id);
      expect(stock1).toBe(8);
      expect(stock2).toBe(19);
    });

    test('创建订单后应清空购物车', async () => {
      const product = await createTestProduct({ price: 99, stock: 10 });
      await addToCart(testUser.id, product.id, 1);

      await request(app.callback())
        .post('/api/orders/create')
        .set('Authorization', authToken)
        .send({ shipping_address: '测试地址' });

      const cartResponse = await request(app.callback())
        .get('/api/cart')
        .set('Authorization', authToken);

      expect(cartResponse.body.data.items.length).toBe(0);
    });
  });

  describe('POST /api/orders/create - 参数校验', () => {
    test('未提供收货地址时应返回400错误', async () => {
      const product = await createTestProduct({ stock: 10 });
      await addToCart(testUser.id, product.id, 1);

      const response = await request(app.callback())
        .post('/api/orders/create')
        .set('Authorization', authToken)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('收货地址不能为空');
    });

    test('空白收货地址应返回400错误', async () => {
      const product = await createTestProduct({ stock: 10 });
      await addToCart(testUser.id, product.id, 1);

      const response = await request(app.callback())
        .post('/api/orders/create')
        .set('Authorization', authToken)
        .send({ shipping_address: '   ' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('收货地址不能为空');
    });

    test('购物车为空时应返回400错误', async () => {
      const response = await request(app.callback())
        .post('/api/orders/create')
        .set('Authorization', authToken)
        .send({ shipping_address: '测试地址' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('购物车是空的');
    });

    test('未登录时应返回401错误', async () => {
      const response = await request(app.callback())
        .post('/api/orders/create')
        .send({ shipping_address: '测试地址' });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/orders/create - 库存不足场景', () => {
    test('购买数量超过库存时应返回400错误', async () => {
      const product = await createTestProduct({ name: '限量商品', price: 100, stock: 3 });
      await addToCart(testUser.id, product.id, 5);

      const response = await request(app.callback())
        .post('/api/orders/create')
        .set('Authorization', authToken)
        .send({ shipping_address: '测试地址' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('库存不足');
      expect(response.body.message).toContain('仅剩 3 件');

      const remainingStock = await getProductStock(product.id);
      expect(remainingStock).toBe(3);
    });

    test('多商品中一个库存不足应整体失败', async () => {
      const product1 = await createTestProduct({ name: '商品1', price: 100, stock: 10 });
      const product2 = await createTestProduct({ name: '商品2', price: 200, stock: 2 });
      await addToCart(testUser.id, product1.id, 1);
      await addToCart(testUser.id, product2.id, 5);

      const response = await request(app.callback())
        .post('/api/orders/create')
        .set('Authorization', authToken)
        .send({ shipping_address: '测试地址' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('商品2');
      expect(response.body.message).toContain('库存不足');

      const stock1 = await getProductStock(product1.id);
      const stock2 = await getProductStock(product2.id);
      expect(stock1).toBe(10);
      expect(stock2).toBe(2);
    });

    test('刚好等于库存时应成功创建订单', async () => {
      const product = await createTestProduct({ price: 100, stock: 3 });
      await addToCart(testUser.id, product.id, 3);

      const response = await request(app.callback())
        .post('/api/orders/create')
        .set('Authorization', authToken)
        .send({ shipping_address: '测试地址' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const remainingStock = await getProductStock(product.id);
      expect(remainingStock).toBe(0);
    });
  });

  describe('POST /api/orders/create - 多规格商品', () => {
    test('多规格商品选择规格后应成功下单', async () => {
      const product = await createTestProduct({
        name: '多规格T恤',
        price: 99,
        stock: 0,
        has_multi_spec: 1
      });
      const sku = await createTestSku(product.id, {
        price: 109,
        stock: 20,
        spec_text: '颜色:红色;尺码:M'
      });
      await addToCart(testUser.id, product.id, 2, sku.id, sku.spec_text);

      const response = await request(app.callback())
        .post('/api/orders/create')
        .set('Authorization', authToken)
        .send({ shipping_address: '测试地址' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.total_amount).toBe(218);
      expect(String(response.body.data.items[0].sku_id)).toBe(String(sku.id));
      expect(response.body.data.items[0].product_price).toBe(109);

      const skuStock = await getProductStock(product.id, sku.id);
      expect(skuStock).toBe(18);
    });

    test('多规格商品未选择规格时应返回400错误', async () => {
      const product = await createTestProduct({
        name: '多规格商品',
        has_multi_spec: 1,
        stock: 0
      });
      await addToCart(testUser.id, product.id, 1, null, null);

      const response = await request(app.callback())
        .post('/api/orders/create')
        .set('Authorization', authToken)
        .send({ shipping_address: '测试地址' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('多规格商品');
      expect(response.body.message).toContain('请先选择规格再下单');
    });

    test('多规格商品SKU库存不足时应返回400错误', async () => {
      const product = await createTestProduct({
        name: '多规格商品',
        has_multi_spec: 1,
        stock: 0
      });
      const sku = await createTestSku(product.id, {
        stock: 2,
        spec_text: '颜色:蓝色;尺码:L'
      });
      await addToCart(testUser.id, product.id, 5, sku.id, sku.spec_text);

      const response = await request(app.callback())
        .post('/api/orders/create')
        .set('Authorization', authToken)
        .send({ shipping_address: '测试地址' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('库存不足');
      expect(response.body.message).toContain('(颜色:蓝色;尺码:L)');
    });
  });

  describe('POST /api/orders/create - 使用优惠券', () => {
    test('使用有效固定金额优惠券应成功抵扣', async () => {
      const product = await createTestProduct({ price: 200, stock: 10 });
      await addToCart(testUser.id, product.id, 2);

      const coupon = await createTestCoupon({
        name: '满400减50',
        type: 'fixed',
        value: 50,
        min_amount: 400
      });
      const userCouponId = await giveCouponToUser(testUser.id, coupon.id);

      const response = await request(app.callback())
        .post('/api/orders/create')
        .set('Authorization', authToken)
        .send({
          shipping_address: '测试地址',
          user_coupon_id: userCouponId
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.total_amount).toBe(350);
      expect(response.body.data.coupon_discount).toBe(50);
      expect(response.body.data.discount_amount).toBe(50);
      expect(String(response.body.data.coupon_id)).toBe(String(coupon.id));

      const couponStatus = await getUserCouponStatus(userCouponId);
      expect(couponStatus.status).toBe('used');

      const usedCount = await getCouponUsedCount(coupon.id);
      expect(usedCount).toBe(1);
    });

    test('使用有效折扣优惠券应成功抵扣', async () => {
      const product = await createTestProduct({ price: 150, stock: 10 });
      await addToCart(testUser.id, product.id, 2);

      const coupon = await createTestCoupon({
        name: '满200打9折',
        type: 'percent',
        value: 0.9,
        min_amount: 200
      });
      const userCouponId = await giveCouponToUser(testUser.id, coupon.id);

      const response = await request(app.callback())
        .post('/api/orders/create')
        .set('Authorization', authToken)
        .send({
          shipping_address: '测试地址',
          user_coupon_id: userCouponId
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.coupon_discount).toBe(30);
      expect(response.body.data.total_amount).toBe(270);
    });

    test('已使用的优惠券应返回400错误', async () => {
      const product = await createTestProduct({ price: 300, stock: 10 });
      const coupon = await createTestCoupon({
        type: 'fixed',
        value: 50,
        min_amount: 100
      });
      const userCouponId = await giveCouponToUser(testUser.id, coupon.id);

      await runQuery("UPDATE user_coupons SET status = 'used' WHERE id = ?", [userCouponId]);

      await addToCart(testUser.id, product.id, 1);

      const response = await request(app.callback())
        .post('/api/orders/create')
        .set('Authorization', authToken)
        .send({
          shipping_address: '测试地址',
          user_coupon_id: userCouponId
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('该优惠券已使用');
    });

    test('已过期的优惠券应返回400错误', async () => {
      const product = await createTestProduct({ price: 300, stock: 10 });
      const now = new Date();
      const past = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const earlier = new Date(now.getTime() - 48 * 60 * 60 * 1000);

      const coupon = await createTestCoupon({
        type: 'fixed',
        value: 50,
        min_amount: 100,
        start_time: earlier.toISOString(),
        end_time: past.toISOString()
      });
      const userCouponId = await giveCouponToUser(testUser.id, coupon.id);
      await addToCart(testUser.id, product.id, 1);

      const response = await request(app.callback())
        .post('/api/orders/create')
        .set('Authorization', authToken)
        .send({
          shipping_address: '测试地址',
          user_coupon_id: userCouponId
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('该优惠券已过期');
    });

    test('未满优惠券最低消费金额应返回400错误', async () => {
      const product = await createTestProduct({ price: 100, stock: 10 });
      await addToCart(testUser.id, product.id, 1);

      const coupon = await createTestCoupon({
        name: '满500减100',
        type: 'fixed',
        value: 100,
        min_amount: 500
      });
      const userCouponId = await giveCouponToUser(testUser.id, coupon.id);

      const response = await request(app.callback())
        .post('/api/orders/create')
        .set('Authorization', authToken)
        .send({
          shipping_address: '测试地址',
          user_coupon_id: userCouponId
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('未满500元');
    });

    test('不存在的优惠券ID应返回400错误', async () => {
      const product = await createTestProduct({ price: 100, stock: 10 });
      await addToCart(testUser.id, product.id, 1);

      const response = await request(app.callback())
        .post('/api/orders/create')
        .set('Authorization', authToken)
        .send({
          shipping_address: '测试地址',
          user_coupon_id: 99999
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('优惠券不存在');
    });
  });

  describe('POST /api/orders/create - 使用促销优惠', () => {
    test('折扣促销应正确计算优惠', async () => {
      const product = await createTestProduct({
        name: '打折手机',
        price: 3000,
        stock: 10,
        category: '电子产品'
      });

      const promotion = await createTestPromotion({
        name: '电子产品8折',
        type: 'discount',
        rules: JSON.stringify({ discount: 0.8 })
      });
      await addProductToPromotion(promotion.id, product.id);
      await addToCart(testUser.id, product.id, 1);

      const response = await request(app.callback())
        .post('/api/orders/create')
        .set('Authorization', authToken)
        .send({ shipping_address: '测试地址' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.promotion_discount).toBe(600);
      expect(response.body.data.total_amount).toBe(2400);
    });

    test('满减促销应正确计算优惠', async () => {
      const product = await createTestProduct({
        name: '满减商品',
        price: 150,
        stock: 10,
        category: '服装'
      });

      const promotion = await createTestPromotion({
        name: '满299减50',
        type: 'full_reduction',
        rules: JSON.stringify({ threshold: 299, reduction: 50 })
      });
      await addProductToPromotion(promotion.id, product.id);
      await addToCart(testUser.id, product.id, 2);

      const response = await request(app.callback())
        .post('/api/orders/create')
        .set('Authorization', authToken)
        .send({ shipping_address: '测试地址' });

      expect(response.status).toBe(200);
      expect(response.body.data.promotion_discount).toBe(50);
      expect(response.body.data.total_amount).toBe(250);
    });

    test('买一送一促销应正确计算优惠', async () => {
      const product = await createTestProduct({
        name: '买一送一咖啡',
        price: 68,
        stock: 20,
        category: '食品'
      });

      const promotion = await createTestPromotion({
        name: '食品买一送一',
        type: 'buy_one_get_one',
        rules: JSON.stringify({})
      });
      await addProductToPromotion(promotion.id, product.id);
      await addToCart(testUser.id, product.id, 2);

      const response = await request(app.callback())
        .post('/api/orders/create')
        .set('Authorization', authToken)
        .send({ shipping_address: '测试地址' });

      expect(response.status).toBe(200);
      expect(response.body.data.promotion_discount).toBe(68);
      expect(response.body.data.total_amount).toBe(68);
    });

    test('未达满减门槛不享受优惠', async () => {
      const product = await createTestProduct({
        name: '测试商品',
        price: 100,
        stock: 10
      });

      const promotion = await createTestPromotion({
        name: '满500减100',
        type: 'full_reduction',
        rules: JSON.stringify({ threshold: 500, reduction: 100 })
      });
      await addProductToPromotion(promotion.id, product.id);
      await addToCart(testUser.id, product.id, 2);

      const response = await request(app.callback())
        .post('/api/orders/create')
        .set('Authorization', authToken)
        .send({ shipping_address: '测试地址' });

      expect(response.status).toBe(200);
      expect(response.body.data.promotion_discount).toBe(0);
      expect(response.body.data.total_amount).toBe(200);
    });
  });

  describe('POST /api/orders/create - 优惠券和促销叠加', () => {
    test('先计算促销再计算优惠券应正确叠加', async () => {
      const product = await createTestProduct({
        price: 500,
        stock: 10
      });

      const promotion = await createTestPromotion({
        type: 'discount',
        rules: JSON.stringify({ discount: 0.8 })
      });
      await addProductToPromotion(promotion.id, product.id);

      const coupon = await createTestCoupon({
        name: '满300减50',
        type: 'fixed',
        value: 50,
        min_amount: 300
      });
      const userCouponId = await giveCouponToUser(testUser.id, coupon.id);

      await addToCart(testUser.id, product.id, 1);

      const response = await request(app.callback())
        .post('/api/orders/create')
        .set('Authorization', authToken)
        .send({
          shipping_address: '测试地址',
          user_coupon_id: userCouponId
        });

      expect(response.status).toBe(200);
      expect(response.body.data.promotion_discount).toBe(100);
      expect(response.body.data.coupon_discount).toBe(50);
      expect(response.body.data.discount_amount).toBe(150);
      expect(response.body.data.total_amount).toBe(350);
    });

    test('促销后金额不足优惠券门槛应不能使用优惠券', async () => {
      const product = await createTestProduct({
        price: 300,
        stock: 10
      });

      const promotion = await createTestPromotion({
        type: 'discount',
        rules: JSON.stringify({ discount: 0.5 })
      });
      await addProductToPromotion(promotion.id, product.id);

      const coupon = await createTestCoupon({
        name: '满200减30',
        type: 'fixed',
        value: 30,
        min_amount: 200
      });
      const userCouponId = await giveCouponToUser(testUser.id, coupon.id);

      await addToCart(testUser.id, product.id, 1);

      const response = await request(app.callback())
        .post('/api/orders/create')
        .set('Authorization', authToken)
        .send({
          shipping_address: '测试地址',
          user_coupon_id: userCouponId
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('未满200元');
    });

    test('叠加优惠后最低为0元', async () => {
      const product = await createTestProduct({
        price: 100,
        stock: 10
      });

      const promotion = await createTestPromotion({
        type: 'discount',
        rules: JSON.stringify({ discount: 0.5 })
      });
      await addProductToPromotion(promotion.id, product.id);

      const coupon = await createTestCoupon({
        type: 'fixed',
        value: 100,
        min_amount: 0
      });
      const userCouponId = await giveCouponToUser(testUser.id, coupon.id);

      await addToCart(testUser.id, product.id, 1);

      const response = await request(app.callback())
        .post('/api/orders/create')
        .set('Authorization', authToken)
        .send({
          shipping_address: '测试地址',
          user_coupon_id: userCouponId
        });

      expect(response.status).toBe(200);
      expect(response.body.data.total_amount).toBe(0);
    });
  });

  describe('POST /api/orders/calculate - 订单价格计算', () => {
    test('应正确计算空购物车', async () => {
      const response = await request(app.callback())
        .post('/api/orders/calculate')
        .set('Authorization', authToken)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.original_total).toBe(0);
      expect(response.body.data.final_total).toBe(0);
    });

    test('应正确计算商品原价', async () => {
      const product1 = await createTestProduct({ price: 100, stock: 10 });
      const product2 = await createTestProduct({ price: 200, stock: 10 });
      await addToCart(testUser.id, product1.id, 2);
      await addToCart(testUser.id, product2.id, 1);

      const response = await request(app.callback())
        .post('/api/orders/calculate')
        .set('Authorization', authToken)
        .send({});

      expect(response.body.data.original_total).toBe(400);
      expect(response.body.data.final_total).toBe(400);
      expect(response.body.data.item_details.length).toBe(2);
    });

    test('应正确计算促销折扣', async () => {
      const product = await createTestProduct({ price: 100, stock: 10 });
      const promotion = await createTestPromotion({
        type: 'discount',
        rules: JSON.stringify({ discount: 0.8 })
      });
      await addProductToPromotion(promotion.id, product.id);
      await addToCart(testUser.id, product.id, 2);

      const response = await request(app.callback())
        .post('/api/orders/calculate')
        .set('Authorization', authToken)
        .send({});

      expect(response.body.data.original_total).toBe(200);
      expect(response.body.data.promotion_discount).toBe(40);
      expect(response.body.data.final_total).toBe(160);
    });

    test('应正确计算优惠券折扣', async () => {
      const product = await createTestProduct({ price: 300, stock: 10 });
      await addToCart(testUser.id, product.id, 1);

      const coupon = await createTestCoupon({
        type: 'fixed',
        value: 50,
        min_amount: 200
      });
      const userCouponId = await giveCouponToUser(testUser.id, coupon.id);

      const response = await request(app.callback())
        .post('/api/orders/calculate')
        .set('Authorization', authToken)
        .send({ user_coupon_id: userCouponId });

      expect(response.body.data.coupon_discount).toBe(50);
      expect(response.body.data.final_total).toBe(250);
      expect(response.body.data.selected_coupon).toBeDefined();
      expect(response.body.data.selected_coupon.discount).toBe(50);
    });
  });
});

describe('订单创建 - 并发库存扣减测试', () => {
  let testUser;
  let authToken;

  beforeEach(async () => {
    await cleanAllTables();
    testUser = await createTestUser();
    authToken = `Bearer ${generateToken(testUser.id)}`;
  });

  test('并发创建订单时库存扣减应正确', async () => {
    const initialStock = 10;
    const product = await createTestProduct({
      name: '并发测试商品',
      price: 100,
      stock: initialStock
    });

    const createOrderForUser = async (userId, userToken) => {
      await runQuery(
        'INSERT INTO carts (user_id, product_id, quantity) VALUES (?, ?, ?)',
        [userId, product.id, 1]
      );

      return request(app.callback())
        .post('/api/orders/create')
        .set('Authorization', userToken)
        .send({ shipping_address: '并发测试地址' });
    };

    const users = [];
    const tokens = [];
    for (let i = 0; i < 15; i++) {
      const user = await createTestUser(`concurrent_user_${i}`, `concurrent_${i}@test.com`);
      users.push(user);
      tokens.push(`Bearer ${generateToken(user.id)}`);
    }

    const promises = users.map((user, index) =>
      createOrderForUser(user.id, tokens[index])
    );
    const results = await Promise.allSettled(promises);

    const successfulOrders = results.filter(
      r => r.status === 'fulfilled' && r.value.status === 200
    ).length;
    const failedOrders = results.filter(
      r => r.status === 'fulfilled' && r.value.status === 400
    ).length;

    expect(successfulOrders).toBeLessThanOrEqual(initialStock);
    expect(successfulOrders + failedOrders).toBe(15);

    const finalStock = await getProductStock(product.id);
    expect(finalStock).toBeGreaterThanOrEqual(0);
    expect(finalStock).toBe(initialStock - successfulOrders);
  });

  test('并发购买同一件多SKU商品时库存扣减应正确', async () => {
    const product = await createTestProduct({
      name: '多规格并发商品',
      has_multi_spec: 1,
      stock: 0
    });
    const sku = await createTestSku(product.id, {
      price: 99,
      stock: 5,
      spec_text: '颜色:红色'
    });

    const createSkuOrder = async (userId, userToken) => {
      await runQuery(
        'INSERT INTO carts (user_id, product_id, sku_id, sku_name, quantity) VALUES (?, ?, ?, ?, ?)',
        [userId, product.id, sku.id, sku.spec_text, 1]
      );

      return request(app.callback())
        .post('/api/orders/create')
        .set('Authorization', userToken)
        .send({ shipping_address: 'SKU并发测试' });
    };

    const users = [];
    const tokens = [];
    for (let i = 0; i < 10; i++) {
      const user = await createTestUser(`sku_user_${i}`, `sku_${i}@test.com`);
      users.push(user);
      tokens.push(`Bearer ${generateToken(user.id)}`);
    }

    const promises = users.map((user, index) =>
      createSkuOrder(user.id, tokens[index])
    );
    const results = await Promise.allSettled(promises);

    const successfulOrders = results.filter(
      r => r.status === 'fulfilled' && r.value.status === 200
    ).length;

    expect(successfulOrders).toBeLessThanOrEqual(5);

    const finalSkuStock = await getProductStock(product.id, sku.id);
    expect(finalSkuStock).toBe(5 - successfulOrders);
    expect(finalSkuStock).toBeGreaterThanOrEqual(0);
  });
});
