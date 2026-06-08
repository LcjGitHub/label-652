import { calculatePromotionPrice, getPromotionDisplayText, calculateCouponDiscount, getCouponDisplayText } from '../../database.js';

describe('calculatePromotionPrice', () => {
  describe('无促销活动', () => {
    test('传入 null 促销应返回原价', () => {
      const result = calculatePromotionPrice(null, 100, 2);
      expect(result.finalPrice).toBe(200);
      expect(result.discount).toBe(0);
      expect(result.promotion).toBeNull();
    });

    test('传入 undefined 促销应返回原价', () => {
      const result = calculatePromotionPrice(undefined, 50, 3);
      expect(result.finalPrice).toBe(150);
      expect(result.discount).toBe(0);
    });
  });

  describe('折扣促销 (discount)', () => {
    test('8折优惠 - 单商品', () => {
      const promotion = {
        type: 'discount',
        rules: { discount: 0.8 }
      };
      const result = calculatePromotionPrice(promotion, 100, 1);
      expect(result.finalPrice).toBe(80);
      expect(result.discount).toBe(20);
    });

    test('8折优惠 - 多商品', () => {
      const promotion = {
        type: 'discount',
        rules: { discount: 0.8 }
      };
      const result = calculatePromotionPrice(promotion, 100, 3);
      expect(result.finalPrice).toBe(240);
      expect(result.discount).toBe(60);
    });

    test('5折优惠 - 保留两位小数', () => {
      const promotion = {
        type: 'discount',
        rules: { discount: 0.5 }
      };
      const result = calculatePromotionPrice(promotion, 99.99, 1);
      expect(result.finalPrice).toBe(50);
      expect(result.discount).toBe(50);
    });

    test('无折扣规则时按原价计算', () => {
      const promotion = {
        type: 'discount',
        rules: {}
      };
      const result = calculatePromotionPrice(promotion, 100, 2);
      expect(result.finalPrice).toBe(200);
      expect(result.discount).toBe(0);
    });
  });

  describe('满减促销 (full_reduction)', () => {
    test('满299减50 - 达到门槛', () => {
      const promotion = {
        type: 'full_reduction',
        rules: { threshold: 299, reduction: 50 }
      };
      const result = calculatePromotionPrice(promotion, 150, 2);
      expect(result.finalPrice).toBe(250);
      expect(result.discount).toBe(50);
    });

    test('满299减50 - 未达到门槛', () => {
      const promotion = {
        type: 'full_reduction',
        rules: { threshold: 299, reduction: 50 }
      };
      const result = calculatePromotionPrice(promotion, 100, 2);
      expect(result.finalPrice).toBe(200);
      expect(result.discount).toBe(0);
    });

    test('满299减50 - 刚好等于门槛', () => {
      const promotion = {
        type: 'full_reduction',
        rules: { threshold: 299, reduction: 50 }
      };
      const result = calculatePromotionPrice(promotion, 299, 1);
      expect(result.finalPrice).toBe(249);
      expect(result.discount).toBe(50);
    });

    test('满100减20 - 超过门槛多倍', () => {
      const promotion = {
        type: 'full_reduction',
        rules: { threshold: 100, reduction: 20 }
      };
      const result = calculatePromotionPrice(promotion, 100, 5);
      expect(result.finalPrice).toBe(480);
      expect(result.discount).toBe(20);
    });
  });

  describe('买一送一促销 (buy_one_get_one)', () => {
    test('买1件 - 实际付1件', () => {
      const promotion = {
        type: 'buy_one_get_one',
        rules: {}
      };
      const result = calculatePromotionPrice(promotion, 100, 1);
      expect(result.finalPrice).toBe(100);
      expect(result.discount).toBe(0);
    });

    test('买2件 - 实际付1件', () => {
      const promotion = {
        type: 'buy_one_get_one',
        rules: {}
      };
      const result = calculatePromotionPrice(promotion, 100, 2);
      expect(result.finalPrice).toBe(100);
      expect(result.discount).toBe(100);
    });

    test('买3件 - 实际付2件', () => {
      const promotion = {
        type: 'buy_one_get_one',
        rules: {}
      };
      const result = calculatePromotionPrice(promotion, 100, 3);
      expect(result.finalPrice).toBe(200);
      expect(result.discount).toBe(100);
    });

    test('买4件 - 实际付2件', () => {
      const promotion = {
        type: 'buy_one_get_one',
        rules: {}
      };
      const result = calculatePromotionPrice(promotion, 100, 4);
      expect(result.finalPrice).toBe(200);
      expect(result.discount).toBe(200);
    });

    test('买5件 - 实际付3件', () => {
      const promotion = {
        type: 'buy_one_get_one',
        rules: {}
      };
      const result = calculatePromotionPrice(promotion, 100, 5);
      expect(result.finalPrice).toBe(300);
      expect(result.discount).toBe(200);
    });
  });

  describe('未知促销类型', () => {
    test('未知类型应返回原价', () => {
      const promotion = {
        type: 'unknown_type',
        rules: {}
      };
      const result = calculatePromotionPrice(promotion, 100, 2);
      expect(result.finalPrice).toBe(200);
      expect(result.discount).toBe(0);
    });
  });
});

describe('getPromotionDisplayText', () => {
  test('折扣促销显示为X折', () => {
    expect(getPromotionDisplayText({ type: 'discount', rules: { discount: 0.8 } })).toBe('8折');
    expect(getPromotionDisplayText({ type: 'discount', rules: { discount: 0.5 } })).toBe('5折');
    expect(getPromotionDisplayText({ type: 'discount', rules: { discount: 0.95 } })).toBe('10折');
  });

  test('满减促销显示为满X减Y', () => {
    expect(getPromotionDisplayText({ type: 'full_reduction', rules: { threshold: 299, reduction: 50 } })).toBe('满299减50');
    expect(getPromotionDisplayText({ type: 'full_reduction', rules: { threshold: 100, reduction: 20 } })).toBe('满100减20');
  });

  test('买一送一显示为买一送一', () => {
    expect(getPromotionDisplayText({ type: 'buy_one_get_one', rules: {} })).toBe('买一送一');
  });

  test('传入 null 应返回 null', () => {
    expect(getPromotionDisplayText(null)).toBeNull();
  });

  test('未知类型应返回 null', () => {
    expect(getPromotionDisplayText({ type: 'unknown' })).toBeNull();
  });
});

describe('calculateCouponDiscount', () => {
  describe('固定金额优惠券 (fixed)', () => {
    test('满200减50 - 达到门槛', () => {
      const coupon = { type: 'fixed', value: 50, min_amount: 200 };
      const result = calculateCouponDiscount(coupon, 300);
      expect(result.discount).toBe(50);
      expect(result.valid).toBe(true);
    });

    test('满200减50 - 刚好达到门槛', () => {
      const coupon = { type: 'fixed', value: 50, min_amount: 200 };
      const result = calculateCouponDiscount(coupon, 200);
      expect(result.discount).toBe(50);
      expect(result.valid).toBe(true);
    });

    test('满200减50 - 未达到门槛', () => {
      const coupon = { type: 'fixed', value: 50, min_amount: 200 };
      const result = calculateCouponDiscount(coupon, 150);
      expect(result.discount).toBe(0);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('未满200元');
    });

    test('无门槛优惠券 - 固定金额', () => {
      const coupon = { type: 'fixed', value: 10, min_amount: 0 };
      const result = calculateCouponDiscount(coupon, 5);
      expect(result.discount).toBe(5);
      expect(result.valid).toBe(true);
    });

    test('优惠金额不超过订单金额', () => {
      const coupon = { type: 'fixed', value: 100, min_amount: 0 };
      const result = calculateCouponDiscount(coupon, 50);
      expect(result.discount).toBe(50);
      expect(result.valid).toBe(true);
    });
  });

  describe('折扣优惠券 (percent)', () => {
    test('满100打9折 - 达到门槛', () => {
      const coupon = { type: 'percent', value: 0.9, min_amount: 100 };
      const result = calculateCouponDiscount(coupon, 200);
      expect(result.discount).toBe(20);
      expect(result.valid).toBe(true);
    });

    test('满100打9折 - 未达到门槛', () => {
      const coupon = { type: 'percent', value: 0.9, min_amount: 100 };
      const result = calculateCouponDiscount(coupon, 50);
      expect(result.discount).toBe(0);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('未满100元');
    });

    test('8折优惠券', () => {
      const coupon = { type: 'percent', value: 0.8, min_amount: 0 };
      const result = calculateCouponDiscount(coupon, 100);
      expect(result.discount).toBe(20);
      expect(result.valid).toBe(true);
    });

    test('95折优惠券 - 保留两位小数', () => {
      const coupon = { type: 'percent', value: 0.95, min_amount: 0 };
      const result = calculateCouponDiscount(coupon, 99.99);
      expect(result.discount).toBe(5);
      expect(result.valid).toBe(true);
    });
  });

  describe('异常情况', () => {
    test('传入 null 优惠券', () => {
      const result = calculateCouponDiscount(null, 100);
      expect(result.discount).toBe(0);
      expect(result.valid).toBe(false);
    });

    test('未知优惠券类型', () => {
      const coupon = { type: 'unknown', value: 50, min_amount: 0 };
      const result = calculateCouponDiscount(coupon, 100);
      expect(result.discount).toBe(0);
      expect(result.valid).toBe(false);
    });

    test('min_amount 为 undefined', () => {
      const coupon = { type: 'fixed', value: 50 };
      const result = calculateCouponDiscount(coupon, 100);
      expect(result.discount).toBe(50);
      expect(result.valid).toBe(true);
    });
  });
});

describe('getCouponDisplayText', () => {
  test('固定金额优惠券显示为¥X', () => {
    expect(getCouponDisplayText({ type: 'fixed', value: 50 })).toBe('¥50');
    expect(getCouponDisplayText({ type: 'fixed', value: 100 })).toBe('¥100');
    expect(getCouponDisplayText({ type: 'fixed', value: 9.9 })).toBe('¥9.9');
  });

  test('折扣优惠券显示为X折', () => {
    expect(getCouponDisplayText({ type: 'percent', value: 0.9 })).toBe('9折');
    expect(getCouponDisplayText({ type: 'percent', value: 0.85 })).toBe('9折');
    expect(getCouponDisplayText({ type: 'percent', value: 0.5 })).toBe('5折');
  });

  test('传入 null 应返回 null', () => {
    expect(getCouponDisplayText(null)).toBeNull();
  });

  test('未知类型应返回 null', () => {
    expect(getCouponDisplayText({ type: 'unknown' })).toBeNull();
  });
});
