export type Database = {
  public: {
    Enums: {
      account_role: 'customer' | 'admin'
      order_status: 'awaiting_payment' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded'
      payment_status: 'pending' | 'approved' | 'rejected' | 'refunded'
      discount_kind: 'percentage' | 'fixed'
    }
  }
}
