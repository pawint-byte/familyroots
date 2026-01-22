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

  constructor() {
    this.apiKey = process.env.PRINTFUL_API_KEY || '';
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
      19,  // Unisex Staple T-Shirt
      71,  // Ceramic Mug 11oz
      1,   // Enhanced Matte Paper Poster
      380, // Premium Pillow
      181, // All-Over Print Tote Bag
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

  getRecommendedProducts() {
    return [
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
      },
      {
        id: 71,
        name: 'Unisex T-Shirt',
        description: 'Wear your family heritage with pride on a comfortable cotton t-shirt.',
        category: 'apparel',
        basePrice: 11.69,
        image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop&q=80',
        maxMembers: 25,
        printArea: 'front',
        recommendation: 'Best for medium trees (up to 25 members). Printed on front chest area.',
      },
      {
        id: 1,
        name: 'Enhanced Matte Poster',
        description: 'Display your family tree beautifully with a museum-quality poster.',
        category: 'home-decor',
        basePrice: 8.00,
        image: 'https://images.unsplash.com/photo-1513519245088-0e12902e35ca?w=400&h=400&fit=crop&q=80',
        maxMembers: 100,
        printArea: 'full',
        recommendation: 'Best for large trees (any size). Full poster shows complete detail.',
      },
      {
        id: 380,
        name: 'Premium Pillow',
        description: 'A cozy pillow featuring your family tree for home comfort.',
        category: 'home-decor',
        basePrice: 16.95,
        image: 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=400&h=400&fit=crop&q=80',
        maxMembers: 20,
        printArea: 'front',
        recommendation: 'Best for small-medium trees (up to 20 members). Printed on pillow face.',
      },
      {
        id: 181,
        name: 'All-Over Print Tote Bag',
        description: 'Carry your family pride everywhere with a stylish tote bag.',
        category: 'accessories',
        basePrice: 13.95,
        image: 'https://images.unsplash.com/photo-1597633125097-5a9ae3a9a4f8?w=400&h=400&fit=crop&q=80',
        maxMembers: 30,
        printArea: 'full',
        recommendation: 'Great for medium trees (up to 30 members). All-over print shows detail.',
      },
    ];
  }
}

export const printfulService = new PrintfulService();
export type { PrintfulProduct, PrintfulVariant, PrintfulShippingRate, ShippingAddress, OrderItem };
