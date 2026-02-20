const PRINTFUL_API_URL = 'https://api.printful.com';

interface PrintfulProduct {
  id: number;
  type: string;
  type_name: string;
  brand: string | null;
  model: string;
  image: string;
  variant_count: number;
  currency: string;
  files: Array<{
    id: string;
    type: string;
    title: string;
    additional_price: string | null;
  }>;
  options: Array<{
    id: string;
    title: string;
    type: string;
    values: Record<string, string>;
    additional_price_breakdown: Record<string, string>;
  }>;
  is_discontinued: boolean;
  avg_fulfillment_time: number | null;
  description: string;
  techniques: Array<{ key: string; display_name: string; is_default: boolean }>;
}

interface PrintfulVariant {
  id: number;
  product_id: number;
  name: string;
  size: string;
  color: string;
  color_code: string;
  color_code2: string | null;
  image: string;
  price: string;
  in_stock: boolean;
  availability_regions: Record<string, string>;
  availability_status: Array<{
    region: string;
    status: string;
  }>;
}

interface PrintfulShippingRate {
  id: string;
  name: string;
  rate: string;
  currency: string;
  minDeliveryDays: number;
  maxDeliveryDays: number;
  minDeliveryDate: string;
  maxDeliveryDate: string;
}

interface ShippingAddress {
  name: string;
  address1: string;
  address2?: string;
  city: string;
  state_code: string;
  country_code: string;
  zip: string;
  phone?: string;
  email?: string;
}

interface OrderItem {
  variant_id: number;
  quantity: number;
  files: Array<{
    type: string;
    url: string;
  }>;
}

class PrintfulService {
  private apiKey: string;
  private imageCache: Map<number, string> = new Map();
  private imageCacheTime: number = 0;
  private readonly IMAGE_CACHE_TTL = 1000 * 60 * 60; // 1 hour

  constructor() {
    this.apiKey = process.env.PRINTFUL_API_KEY || '';
  }

  async fetchCatalogImage(productId: number): Promise<string | null> {
    try {
      const response = await fetch(`${PRINTFUL_API_URL}/products/${productId}`, {
        headers: this.getHeaders(),
      });
      if (!response.ok) return null;
      const data = await response.json() as { result: { product: { image: string } } };
      return data.result.product.image || null;
    } catch (error) {
      console.error(`Failed to fetch catalog image for product ${productId}:`, error);
      return null;
    }
  }

  async fetchAllCatalogImages(productIds: number[]): Promise<void> {
    const now = Date.now();
    if (this.imageCache.size > 0 && (now - this.imageCacheTime) < this.IMAGE_CACHE_TTL) {
      return;
    }

    if (!this.apiKey) return;

    const results = await Promise.allSettled(
      productIds.map(async (id) => {
        const image = await this.fetchCatalogImage(id);
        if (image) {
          this.imageCache.set(id, image);
        }
      })
    );
    this.imageCacheTime = now;
    console.log(`[printful] Fetched catalog images for ${this.imageCache.size}/${productIds.length} products`);
  }

  private getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${PRINTFUL_API_URL}/store`, {
        headers: this.getHeaders(),
      });
      return response.ok;
    } catch (error) {
      console.error('Printful connection test failed:', error);
      return false;
    }
  }

  async getCatalogProducts(): Promise<PrintfulProduct[]> {
    const productIds = [
      19,  // White Glossy Mug
      71,  // Cotton T-Shirt
      1,   // Enhanced Matte Paper Poster
      214, // All-Over Print Premium Pillow
      84,  // All-Over Print Tote Bag
    ];

    const products: PrintfulProduct[] = [];

    for (const id of productIds) {
      try {
        const response = await fetch(`${PRINTFUL_API_URL}/products/${id}`, {
          headers: this.getHeaders(),
        });
        
        if (response.ok) {
          const data = await response.json() as { result: { product: PrintfulProduct } };
          products.push(data.result.product);
        }
      } catch (error) {
        console.error(`Failed to fetch product ${id}:`, error);
      }
    }

    return products;
  }

  async getProduct(productId: number): Promise<PrintfulProduct | null> {
    try {
      const response = await fetch(`${PRINTFUL_API_URL}/products/${productId}`, {
        headers: this.getHeaders(),
      });
      
      if (!response.ok) {
        console.error('Failed to fetch product:', await response.text());
        return null;
      }
      
      const data = await response.json() as { result: { product: PrintfulProduct } };
      return data.result.product;
    } catch (error) {
      console.error('Error fetching product:', error);
      return null;
    }
  }

  async getProductVariants(productId: number): Promise<PrintfulVariant[]> {
    try {
      const response = await fetch(`${PRINTFUL_API_URL}/products/${productId}`, {
        headers: this.getHeaders(),
      });
      
      if (!response.ok) {
        console.error('Failed to fetch product variants:', await response.text());
        return [];
      }
      
      const data = await response.json() as { result: { variants: PrintfulVariant[] } };
      return data.result.variants || [];
    } catch (error) {
      console.error('Error fetching product variants:', error);
      return [];
    }
  }

  async getVariant(productId: number, variantId: number): Promise<PrintfulVariant | null> {
    try {
      const variants = await this.getProductVariants(productId);
      return variants.find(v => v.id === variantId) || null;
    } catch (error) {
      console.error('Error fetching variant:', error);
      return null;
    }
  }

  async getVariantPrice(productId: number, variantId: number): Promise<number | null> {
    const variant = await this.getVariant(productId, variantId);
    if (!variant) return null;
    // Printful prices are in dollars as strings, convert to cents
    return Math.round(parseFloat(variant.price) * 100);
  }

  async calculateShipping(
    address: ShippingAddress,
    items: Array<{ variant_id: number; quantity: number }>
  ): Promise<PrintfulShippingRate[]> {
    try {
      const response = await fetch(`${PRINTFUL_API_URL}/shipping/rates`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          recipient: address,
          items: items.map(item => ({
            variant_id: item.variant_id,
            quantity: item.quantity,
          })),
        }),
      });
      
      if (!response.ok) {
        console.error('Failed to calculate shipping:', await response.text());
        return [];
      }
      
      const data = await response.json() as { result: PrintfulShippingRate[] };
      return data.result || [];
    } catch (error) {
      console.error('Error calculating shipping:', error);
      return [];
    }
  }

  async createOrder(
    address: ShippingAddress,
    items: OrderItem[],
    confirm: boolean = false
  ): Promise<{ orderId: number; status: string } | null> {
    try {
      const response = await fetch(`${PRINTFUL_API_URL}/orders${confirm ? '?confirm=true' : ''}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          recipient: address,
          items,
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to create order:', errorText);
        return null;
      }
      
      const data = await response.json() as { result: { id: number; status: string } };
      return {
        orderId: data.result.id,
        status: data.result.status,
      };
    } catch (error) {
      console.error('Error creating order:', error);
      return null;
    }
  }

  async getOrder(orderId: number): Promise<any> {
    try {
      const response = await fetch(`${PRINTFUL_API_URL}/orders/${orderId}`, {
        headers: this.getHeaders(),
      });
      
      if (!response.ok) {
        console.error('Failed to fetch order:', await response.text());
        return null;
      }
      
      const data = await response.json() as { result: any };
      return data.result;
    } catch (error) {
      console.error('Error fetching order:', error);
      return null;
    }
  }

  async confirmOrder(orderId: number): Promise<boolean> {
    try {
      const response = await fetch(`${PRINTFUL_API_URL}/orders/${orderId}/confirm`, {
        method: 'POST',
        headers: this.getHeaders(),
      });
      
      return response.ok;
    } catch (error) {
      console.error('Error confirming order:', error);
      return false;
    }
  }

  async cancelOrder(orderId: number): Promise<boolean> {
    try {
      const response = await fetch(`${PRINTFUL_API_URL}/orders/${orderId}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
      
      return response.ok;
    } catch (error) {
      console.error('Error cancelling order:', error);
      return false;
    }
  }

  async getRecommendedProducts() {
    const products = this.getRecommendedProductsSync();
    const productIds = products.map(p => p.id);
    await this.fetchAllCatalogImages(productIds);
    return products.map(p => ({
      ...p,
      image: this.imageCache.get(p.id) || p.image,
    }));
  }

  private getRecommendedProductsSync() {
    return [
      {
        id: 71,
        name: 'The Connection Shirt',
        description: 'The shirt that grows your network. Pick a QR code — site signup, a specific tree or group, or your personal profile — and wear it anywhere. Anyone who scans it connects instantly.',
        category: 'apparel',
        basePrice: 11.69,
        image: '/images/products/cotton-tee.jpg',
        maxMembers: 25,
        printArea: 'front',
        recommendation: 'Fan Favorite! Choose which QR code to print — site signup, your tree/group invite, or your profile link.',
        isFeatured: true,
        featuredScenario: 'connection-shirt',
        isConnectionShirt: true,
        placements: [
          { id: 'front', label: 'Front', printfulType: 'front', description: 'Full front chest area' },
          { id: 'back', label: 'Back', printfulType: 'back', description: 'Full back area' },
          { id: 'front_left', label: 'Front Left (Over Heart)', printfulType: 'label_outside', description: 'Small print over the heart area' },
        ],
      },
      {
        id: 505,
        name: 'QR Connection Sticker',
        description: 'The cheapest way to spread the word. Hand these die-cut vinyl stickers out at school, practice, meetings, or reunions — anyone who scans joins your group instantly. Weatherproof and laptop-ready.',
        category: 'accessories',
        basePrice: 2.62,
        image: '/images/products/die-cut-sticker.jpg',
        maxMembers: 1,
        printArea: 'front',
        recommendation: 'Lowest cost per unit — perfect for handing out at events, stuffing in envelopes, or sticking on notebooks.',
        isFeatured: false,
        isPromoItem: true,
        bulkHint: 'Best value for bulk orders — hand out dozens at events, reunions, or in classrooms.',
        placements: [
          { id: 'front', label: 'Front', printfulType: 'default', description: 'Full sticker face' },
        ],
      },
      {
        id: 300,
        name: 'Classroom Connection Mug',
        description: 'A glossy black ceramic mug for teachers, coaches, and group leaders. Print your class, team, or group tree on one side and a QR code on the other — students or members scan to stay connected all year.',
        category: 'drinkware',
        basePrice: 8.95,
        image: '/images/products/classroom-mug.jpg',
        maxMembers: 30,
        printArea: 'wrap',
        recommendation: 'Perfect teacher or coach gift. The group tree wraps around the mug, QR code lets anyone scan to join.',
        isFeatured: false,
        bulkHint: 'Great end-of-year gift — one mug per teacher or coach, personalized with their group.',
        placements: [
          { id: 'wrap', label: 'Full Wrap', printfulType: 'default', description: 'Wraps around the entire mug' },
        ],
      },
      {
        id: 77,
        name: 'Snapback Hat',
        description: 'Rock your crew everywhere you go. Structured high-profile snapback with embroidered group name on the front — classic look that shows off your network.',
        category: 'apparel',
        basePrice: 16.00,
        image: '/images/products/snapback-hat.jpg',
        maxMembers: 1,
        printArea: 'front',
        recommendation: 'Classic structured snapback with embroidered design. Flat visor, plastic snap closure.',
        isFeatured: true,
        featuredScenario: 'walking-intro',
        placements: [
          { id: 'front', label: 'Front', printfulType: 'front', description: 'Center front panel' },
        ],
      },
      
      {
        id: 395,
        name: 'Premium Throw Blanket',
        description: 'Your whole team laid out on a soft silk-touch throw blanket. Hang it in the locker room, bring it to tailgates, or drape it over the couch — everyone sees where they stand.',
        category: 'home-decor',
        basePrice: 32.00,
        image: '/images/products/fleece-blanket.jpg',
        maxMembers: 200,
        printArea: 'full',
        recommendation: 'Perfect for sports teams & large groups. Full edge-to-edge sublimation print shows every member.',
        isFeatured: true,
        featuredScenario: 'team-blanket',
        placements: [
          { id: 'front', label: 'Front', printfulType: 'default', description: 'Full blanket face' },
        ],
      },
      {
        id: 19,
        name: 'White Glossy Mug 11oz',
        description: 'Start every morning with your family tree on a high-quality ceramic mug.',
        category: 'drinkware',
        basePrice: 7.95,
        image: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=400&h=400&fit=crop&q=80',
        maxMembers: 15,
        printArea: 'wrap',
        recommendation: 'Best for small trees (up to 15 members). Tree wraps around the mug.',
        placements: [
          { id: 'wrap', label: 'Full Wrap', printfulType: 'default', description: 'Wraps around the entire mug' },
        ],
      },
      {
        id: 1,
        name: 'Enhanced Matte Poster',
        description: 'Display your family tree beautifully with a museum-quality poster.',
        category: 'home-decor',
        basePrice: 8.00,
        image: '/images/products/matte-poster.jpg',
        maxMembers: 100,
        printArea: 'full',
        recommendation: 'Best for large trees (any size). Full poster shows complete detail.',
        placements: [
          { id: 'front', label: 'Full Poster', printfulType: 'default', description: 'Complete poster surface' },
        ],
      },
      {
        id: 214,
        name: 'Premium Pillow',
        description: 'A premium shape-retaining pillow featuring your family tree or group — add a splash of personality to any room.',
        category: 'home-decor',
        basePrice: 16.95,
        image: 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=400&h=400&fit=crop&q=80',
        maxMembers: 20,
        printArea: 'front',
        recommendation: 'Best for small-medium trees (up to 20 members). All-over print on pillow face.',
        placements: [
          { id: 'front', label: 'Front Face', printfulType: 'default', description: 'Pillow front face' },
        ],
      },
      {
        id: 84,
        name: 'All-Over Print Tote Bag',
        description: 'Carry your family pride everywhere with a spacious, all-over-print tote bag. 100% polyester, holds up to 44 lbs.',
        category: 'accessories',
        basePrice: 13.95,
        image: '/images/products/tote-bag.jpg',
        maxMembers: 30,
        printArea: 'full',
        recommendation: 'Great for medium trees (up to 30 members). All-over print shows detail.',
        placements: [
          { id: 'front', label: 'Front', printfulType: 'front', description: 'Bag front panel' },
          { id: 'back', label: 'Back', printfulType: 'back', description: 'Bag back panel' },
        ],
      },
    ];
  }
}

export const printfulService = new PrintfulService();
export type { PrintfulProduct, PrintfulVariant, PrintfulShippingRate, ShippingAddress, OrderItem };
