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
  private storeId: string;
  private imageCache: Map<number, string> = new Map();
  private imageCacheTime: number = 0;
  private readonly IMAGE_CACHE_TTL = 1000 * 60 * 60; // 1 hour

  constructor() {
    this.apiKey = process.env.PRINTFUL_API_KEY || '';
    this.storeId = process.env.PRINTFUL_STORE_ID || '17783050';
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

  private getHeaders(includeStore = false) {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
    if (includeStore && this.storeId) {
      headers['X-PF-Store-Id'] = this.storeId;
    }
    return headers;
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${PRINTFUL_API_URL}/store`, {
        headers: this.getHeaders(true),
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
        headers: this.getHeaders(true),
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

  async estimateTax(
    address: ShippingAddress,
    items: Array<{ variant_id: number; quantity: number }>
  ): Promise<number> {
    try {
      const response = await fetch(`${PRINTFUL_API_URL}/tax/rates`, {
        method: 'POST',
        headers: this.getHeaders(true),
        body: JSON.stringify({
          recipient: {
            country_code: address.country_code,
            state_code: address.state_code,
            city: address.city,
            zip: address.zip,
          },
        }),
      });

      if (!response.ok) {
        console.error('[printful] Tax estimation failed:', await response.text());
        return 0;
      }

      const data = await response.json() as { result: { required: boolean; rate: number; shipping_taxable: boolean } };
      if (!data.result.required) return 0;

      return data.result.rate;
    } catch (error) {
      console.error('[printful] Error estimating tax:', error);
      return 0;
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
        headers: this.getHeaders(true),
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
        headers: this.getHeaders(true),
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
        headers: this.getHeaders(true),
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
        headers: this.getHeaders(true),
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
        recommendedFor: ['family', 'church', 'fraternity', 'friends', 'sports', 'professional', 'custom'],
        bestFor: {
          family: 'Reunion conversation starter — your tree on the front, QR on the back.',
          church: 'Wear it to service — newcomers scan and join your ministry group.',
          fraternity: 'Rush week essential — brothers/sisters scan to connect.',
          sports: 'Team spirit shirt — everyone on the roster wears one.',
          friends: 'Friend group uniform — wear matching shirts at events.',
          professional: 'Networking events — colleagues scan your QR to connect.',
        },
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
        recommendedFor: ['fraternity', 'sports', 'church', 'friends', 'professional', 'family', 'custom'],
        bestFor: {
          fraternity: 'Rush recruitment — hand out stickers at tabling events.',
          sports: 'Game day handouts — fans scan to follow the team.',
          church: 'Sunday welcome packets — visitors scan to join a ministry.',
          family: 'Reunion invites — stick in holiday cards or on party favors.',
          professional: 'Conference swag — drop one on every seat.',
        },
        placements: [
          { id: 'front', label: 'Front', printfulType: 'default', description: 'Full sticker face' },
        ],
      },
      {
        id: 300,
        name: 'Leader\'s Mug',
        description: 'A glossy black ceramic mug for the person who holds the group together. Print your group on one side and a QR code on the other — members scan to stay connected.',
        category: 'drinkware',
        basePrice: 8.95,
        image: '/images/products/classroom-mug.jpg',
        maxMembers: 30,
        printArea: 'wrap',
        recommendation: 'Perfect gift for teachers, coaches, pastors, or chapter presidents.',
        isFeatured: false,
        bulkHint: 'Great end-of-year gift — one mug per leader, personalized with their group.',
        recommendedFor: ['church', 'sports', 'professional', 'fraternity', 'family', 'custom'],
        bestFor: {
          church: 'Pastor appreciation gift — their congregation wraps around the mug.',
          sports: 'Coach\'s desk mug — the whole roster printed on ceramic.',
          professional: 'Manager gift — their team at a glance every morning.',
          fraternity: 'Chapter president gift — brothers/sisters on a keepsake.',
          family: 'Grandparent gift — all the grandkids wrapped around their morning coffee.',
        },
        placements: [
          { id: 'wrap', label: 'Full Wrap', printfulType: 'default', description: 'Wraps around the entire mug' },
        ],
      },
      {
        id: 77,
        name: 'Snapback Hat',
        description: 'Rep your group everywhere you go. Structured high-profile snapback with your group name embroidered on the front — a classic look that says "I belong."',
        category: 'apparel',
        basePrice: 16.00,
        image: '/images/products/snapback-hat.jpg',
        maxMembers: 1,
        printArea: 'front',
        recommendation: 'Classic structured snapback with embroidered design. Flat visor, adjustable snap closure.',
        isFeatured: true,
        featuredScenario: 'walking-intro',
        recommendedFor: ['sports', 'fraternity', 'friends', 'family', 'church', 'professional', 'custom'],
        bestFor: {
          sports: 'Team hat — match day or practice, everyone reps the squad.',
          fraternity: 'Greek life staple — chapter name embroidered front and center.',
          friends: 'Crew hat — your friend group name on full display.',
          family: 'Family reunion cap — "The Johnsons" across the front.',
          church: 'Youth group hat — the ministry name everyone recognizes.',
        },
        placements: [
          { id: 'front', label: 'Front', printfulType: 'front', description: 'Center front panel' },
        ],
      },
      {
        id: 395,
        name: 'Premium Throw Blanket',
        description: 'Every member of your group laid out on a soft silk-touch throw blanket. Hang it up, bring it to events, or cozy up on the couch — everyone sees where they belong.',
        category: 'home-decor',
        basePrice: 32.00,
        image: '/images/products/fleece-blanket.jpg',
        maxMembers: 200,
        printArea: 'full',
        recommendation: 'Full edge-to-edge sublimation print — fits up to 200 members.',
        isFeatured: true,
        featuredScenario: 'team-blanket',
        recommendedFor: ['sports', 'family', 'fraternity', 'church', 'friends', 'professional', 'custom'],
        bestFor: {
          sports: 'Locker room, tailgates, or the couch — every player in their position.',
          family: 'Family tree blanket — hang on the wall or wrap up on movie night.',
          fraternity: 'Chapter house staple — every brother/sister on display.',
          church: 'Congregation keepsake — the whole community in one place.',
          friends: 'Friendiversary gift — your whole circle on a cozy blanket.',
        },
        placements: [
          { id: 'front', label: 'Front', printfulType: 'default', description: 'Full blanket face' },
        ],
      },
      {
        id: 19,
        name: 'White Glossy Mug',
        description: 'A classic white ceramic mug with your group printed around it. Start every morning looking at the people who matter most.',
        category: 'drinkware',
        basePrice: 7.95,
        image: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=400&h=400&fit=crop&q=80',
        maxMembers: 15,
        printArea: 'wrap',
        recommendation: 'Best for small groups (up to 15 members). Your group wraps around the mug.',
        recommendedFor: ['family', 'friends', 'professional', 'church', 'custom'],
        bestFor: {
          family: 'Morning coffee with the whole family tree — classic keepsake.',
          friends: 'Best friends mug — your circle wraps around your daily coffee.',
          professional: 'Small team mug — your department at a glance.',
          church: 'Small group leader mug — your Bible study members printed on ceramic.',
        },
        placements: [
          { id: 'wrap', label: 'Full Wrap', printfulType: 'default', description: 'Wraps around the entire mug' },
        ],
      },
      {
        id: 1,
        name: 'Enhanced Matte Poster',
        description: 'Museum-quality matte poster that displays your entire group beautifully. Frame it for the wall, the office, or the meeting room.',
        category: 'home-decor',
        basePrice: 8.00,
        image: '/images/products/matte-poster.jpg',
        maxMembers: 100,
        printArea: 'full',
        recommendation: 'Fits any group size. Full poster shows every connection in detail.',
        recommendedFor: ['family', 'church', 'professional', 'fraternity', 'sports', 'friends', 'custom'],
        bestFor: {
          family: 'Hang your family tree on the wall — the centerpiece of any room.',
          church: 'Church lobby display — show the full congregation network.',
          professional: 'Office wall — the org chart that actually looks good.',
          fraternity: 'Chapter house poster — lineage on full display.',
          sports: 'Team roster poster — frame it in the athletic hall.',
        },
        placements: [
          { id: 'front', label: 'Full Poster', printfulType: 'default', description: 'Complete poster surface' },
        ],
      },
      {
        id: 214,
        name: 'Premium Pillow',
        description: 'A shape-retaining pillow featuring your group — toss it on the couch or give it as a gift that makes people smile.',
        category: 'home-decor',
        basePrice: 16.95,
        image: 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=400&h=400&fit=crop&q=80',
        maxMembers: 20,
        printArea: 'front',
        recommendation: 'Best for small-medium groups (up to 20 members). All-over print on pillow face.',
        recommendedFor: ['family', 'friends', 'fraternity', 'church', 'custom'],
        bestFor: {
          family: 'Couch pillow with the family tree — cozy and personal.',
          friends: 'Friend group pillow — the perfect housewarming or birthday gift.',
          fraternity: 'Chapter lounge pillow — your line on display.',
          church: 'Small group keepsake — your Bible study crew on a pillow.',
        },
        placements: [
          { id: 'front', label: 'Front Face', printfulType: 'default', description: 'Pillow front face' },
        ],
      },
      {
        id: 84,
        name: 'All-Over Print Tote Bag',
        description: 'Carry your people with you — a spacious tote bag with your group printed all over it. Holds up to 44 lbs.',
        category: 'accessories',
        basePrice: 13.95,
        image: '/images/products/tote-bag.jpg',
        maxMembers: 30,
        printArea: 'full',
        recommendation: 'Great for medium groups (up to 30 members). All-over print shows every connection.',
        recommendedFor: ['church', 'friends', 'family', 'professional', 'fraternity', 'custom'],
        bestFor: {
          church: 'Sunday tote — carry your Bible and show your ministry pride.',
          friends: 'Everyday carry — your friend circle goes everywhere with you.',
          family: 'Family reunion tote — a keepsake bag everyone takes home.',
          professional: 'Conference bag — your team printed on a statement piece.',
          fraternity: 'Chapter event tote — functional and full of pride.',
        },
        placements: [
          { id: 'front', label: 'Front', printfulType: 'default', description: 'Bag front panel (all-over)' },
          { id: 'back', label: 'Back', printfulType: 'default', description: 'Bag back panel (all-over)' },
        ],
      },
    ];
  }
}

export const printfulService = new PrintfulService();
export type { PrintfulProduct, PrintfulVariant, PrintfulShippingRate, ShippingAddress, OrderItem };
