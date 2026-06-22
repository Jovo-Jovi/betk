-- ============================================================
-- categories_seed.sql
-- T06: Starter categories taxonomy for Egypt's informal creative economy.
-- Top-level categories + subcategories (3-4 per top level).
-- Idempotent: ON CONFLICT (slug) DO NOTHING.
-- Self-referential parent_id resolved via slug subquery.
-- ============================================================
SET search_path TO betk, public;

-- ============================================================
-- Step 1: Top-level categories (parent_id NULL)
-- ============================================================
INSERT INTO betk.categories (name_ar, name_en, slug, icon_url, sort_order, is_active)
VALUES
  ('الملابس والأزياء',      'Clothing & Fashion',     'clothing-fashion',    '/icons/categories/clothing.svg',    1,  true),
  ('المجوهرات والإكسسوارات','Jewelry & Accessories',  'jewelry-accessories', '/icons/categories/jewelry.svg',     2,  true),
  ('الفنون والحرف اليدوية', 'Arts & Crafts',          'arts-crafts',         '/icons/categories/arts.svg',        3,  true),
  ('المنزل والديكور',       'Home & Decor',            'home-decor',          '/icons/categories/home.svg',        4,  true),
  ('الجمال والعناية',       'Beauty & Care',           'beauty-care',         '/icons/categories/beauty.svg',      5,  true),
  ('الطعام والمشروبات',     'Food & Beverages',        'food-beverages',      '/icons/categories/food.svg',        6,  true),
  ('الكتب والتعليم',        'Books & Education',       'books-education',     '/icons/categories/books.svg',       7,  true),
  ('الخدمات الإبداعية',     'Creative Services',       'creative-services',   '/icons/categories/services.svg',    8,  true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- Step 2: Subcategories — parent_id resolved by slug join
-- ============================================================
INSERT INTO betk.categories (parent_id, name_ar, name_en, slug, icon_url, sort_order, is_active)
SELECT
  p.id,
  sub.name_ar,
  sub.name_en,
  sub.slug,
  sub.icon_url,
  sub.sort_order,
  true
FROM (VALUES
  -- Clothing & Fashion
  ('clothing-fashion',    'فساتين وتنانير',              'Dresses & Skirts',          'clothing-dresses',          '/icons/categories/clothing-dresses.svg',      1),
  ('clothing-fashion',    'عبايات وأزياء تقليدية',       'Abayas & Traditional Wear', 'clothing-abayas',           '/icons/categories/clothing-abayas.svg',       2),
  ('clothing-fashion',    'ملابس أطفال',                 'Kids'' Clothing',           'clothing-kids',             '/icons/categories/clothing-kids.svg',         3),
  ('clothing-fashion',    'إكسسوارات ملابس',             'Clothing Accessories',      'clothing-accessories',      '/icons/categories/clothing-accessories.svg',  4),

  -- Jewelry & Accessories
  ('jewelry-accessories', 'مجوهرات يدوية',               'Handmade Jewelry',          'jewelry-handmade',          '/icons/categories/jewelry-handmade.svg',      1),
  ('jewelry-accessories', 'ذهب وفضة',                   'Gold & Silver',             'jewelry-gold-silver',       '/icons/categories/jewelry-gold-silver.svg',   2),
  ('jewelry-accessories', 'حقائب',                       'Bags',                      'jewelry-bags',              '/icons/categories/bags.svg',                  3),
  ('jewelry-accessories', 'أوشحة وحجابات',               'Scarves & Hijabs',          'jewelry-scarves',           '/icons/categories/scarves.svg',               4),

  -- Arts & Crafts
  ('arts-crafts',         'لوحات فنية',                  'Paintings & Art',           'arts-paintings',            '/icons/categories/arts-paintings.svg',        1),
  ('arts-crafts',         'خزف وفخار',                   'Pottery & Ceramics',        'arts-pottery',              '/icons/categories/arts-pottery.svg',          2),
  ('arts-crafts',         'خياطة وتطريز',                'Sewing & Embroidery',       'arts-sewing',               '/icons/categories/arts-sewing.svg',           3),
  ('arts-crafts',         'كروشيه وتريكو',               'Crochet & Knitting',        'arts-crochet',              '/icons/categories/arts-crochet.svg',          4),

  -- Home & Decor
  ('home-decor',          'أثاث يدوي',                   'Handmade Furniture',        'home-furniture',            '/icons/categories/home-furniture.svg',        1),
  ('home-decor',          'مفروشات ومنسوجات',             'Textiles & Linen',          'home-textiles',             '/icons/categories/home-textiles.svg',         2),
  ('home-decor',          'شموع وعطور المنزل',           'Candles & Home Scents',     'home-candles',              '/icons/categories/home-candles.svg',          3),
  ('home-decor',          'ديكور الجدران',               'Wall Art & Decor',          'home-wall-art',             '/icons/categories/home-wall-art.svg',         4),

  -- Beauty & Care
  ('beauty-care',         'العناية بالبشرة',             'Skincare',                  'beauty-skincare',           '/icons/categories/beauty-skincare.svg',       1),
  ('beauty-care',         'العناية بالشعر',              'Haircare',                  'beauty-haircare',           '/icons/categories/beauty-haircare.svg',       2),
  ('beauty-care',         'منتجات طبيعية وعضوية',        'Natural & Organic Products','beauty-natural',            '/icons/categories/beauty-natural.svg',        3),
  ('beauty-care',         'حناء وزينة',                  'Henna & Adornments',        'beauty-henna',              '/icons/categories/beauty-henna.svg',          4),

  -- Food & Beverages
  ('food-beverages',      'أكل بيتي ومخبوزات',           'Homemade & Baked Goods',    'food-homemade',             '/icons/categories/food-homemade.svg',         1),
  ('food-beverages',      'حلويات وكيك',                 'Sweets & Cakes',            'food-sweets',               '/icons/categories/food-sweets.svg',           2),
  ('food-beverages',      'مخللات ومربى',                'Pickles & Preserves',       'food-pickles',              '/icons/categories/food-pickles.svg',          3),
  ('food-beverages',      'أعشاب وتوابل',                'Herbs & Spices',            'food-herbs',                '/icons/categories/food-herbs.svg',            4),

  -- Books & Education
  ('books-education',     'كتب مستعملة',                 'Used Books',                'books-used',                '/icons/categories/books-used.svg',            1),
  ('books-education',     'مواد تعليمية',                'Educational Materials',     'books-educational',         '/icons/categories/books-educational.svg',     2),
  ('books-education',     'قرطاسية ولوازم مكتبية',      'Stationery & Supplies',     'books-stationery',          '/icons/categories/books-stationery.svg',      3),

  -- Creative Services
  ('creative-services',   'تصميم جرافيك',                'Graphic Design',            'services-design',           '/icons/categories/services-design.svg',       1),
  ('creative-services',   'تصوير فوتوغرافي',             'Photography',               'services-photography',      '/icons/categories/services-photography.svg',  2),
  ('creative-services',   'خياطة وتفصيل',                'Tailoring & Alterations',   'services-tailoring',        '/icons/categories/services-tailoring.svg',    3),
  ('creative-services',   'خط عربي وزخرفة',              'Arabic Calligraphy',        'services-calligraphy',      '/icons/categories/services-calligraphy.svg',  4)
) AS sub(parent_slug, name_ar, name_en, slug, icon_url, sort_order)
JOIN betk.categories p ON p.slug = sub.parent_slug
ON CONFLICT (slug) DO NOTHING;
