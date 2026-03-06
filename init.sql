-- Initialize the marketplace database
-- This schema is designed for easy migration to cloud PostgreSQL (AWS RDS, Google Cloud SQL, etc.)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Deal statuses: on_air, under_escrow, flagged, taken, archived
CREATE TYPE deal_status AS ENUM ('on_air', 'under_escrow', 'flagged', 'taken', 'archived');

-- Transaction statuses
CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'cancelled', 'disputed');

-- Main deals table
CREATE TABLE deals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    price DECIMAL(10, 2) NOT NULL CHECK (price > 0),
    seller_id VARCHAR(32) NOT NULL, -- Discord user ID
    status deal_status DEFAULT 'on_air',
    avg_rating DECIMAL(2, 1) DEFAULT 0 CHECK (avg_rating >= 0 AND avg_rating <= 5),
    review_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes for common queries
    CONSTRAINT valid_rating CHECK (avg_rating >= 0 AND avg_rating <= 5)
);

-- Reviews table (separate for better performance)
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    user_id VARCHAR(32) NOT NULL, -- Discord user ID
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(deal_id, user_id) -- One review per user per deal
);

-- Users table (caches Discord user data)
CREATE TABLE users (
    id VARCHAR(32) PRIMARY KEY, -- Discord user ID
    reputation DECIMAL(3, 2) DEFAULT 0,
    total_sales INTEGER DEFAULT 0,
    total_purchases INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transactions table
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id UUID NOT NULL REFERENCES deals(id),
    buyer_id VARCHAR(32) NOT NULL REFERENCES users(id),
    seller_id VARCHAR(32) NOT NULL REFERENCES users(id),
    amount DECIMAL(10, 2) NOT NULL,
    status transaction_status DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    escrow_released_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX idx_deals_status ON deals(status);
CREATE INDEX idx_deals_seller ON deals(seller_id);
CREATE INDEX idx_deals_created ON deals(created_at DESC);
CREATE INDEX idx_reviews_deal ON reviews(deal_id);
CREATE INDEX idx_transactions_buyer ON transactions(buyer_id);
CREATE INDEX idx_transactions_seller ON transactions(seller_id);
CREATE INDEX idx_transactions_deal ON transactions(deal_id);
CREATE INDEX idx_transactions_status ON transactions(status);

-- Function to update deal rating when review is added
CREATE OR REPLACE FUNCTION update_deal_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE deals 
    SET avg_rating = (
        SELECT AVG(rating)::DECIMAL(2,1) 
        FROM reviews 
        WHERE deal_id = NEW.deal_id
    ),
    review_count = (
        SELECT COUNT(*) 
        FROM reviews 
        WHERE deal_id = NEW.deal_id
    ),
    updated_at = NOW()
    WHERE id = NEW.deal_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_deal_rating
    AFTER INSERT OR UPDATE OR DELETE ON reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_deal_rating();

-- Function to update user stats
CREATE OR REPLACE FUNCTION update_user_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Update seller stats
    UPDATE users 
    SET total_sales = (
        SELECT COUNT(*) FROM transactions 
        WHERE seller_id = NEW.seller_id AND status = 'completed'
    ),
    updated_at = NOW()
    WHERE id = NEW.seller_id;
    
    -- Update buyer stats
    UPDATE users 
    SET total_purchases = (
        SELECT COUNT(*) FROM transactions 
        WHERE buyer_id = NEW.buyer_id AND status = 'completed'
    ),
    updated_at = NOW()
    WHERE id = NEW.buyer_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_stats
    AFTER INSERT OR UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_user_stats();

-- Function to update deal status based on transaction
CREATE OR REPLACE FUNCTION update_deal_status_on_transaction()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'pending' THEN
        UPDATE deals SET status = 'under_escrow', updated_at = NOW() WHERE id = NEW.deal_id;
    ELSIF NEW.status = 'completed' THEN
        UPDATE deals SET status = 'taken', updated_at = NOW() WHERE id = NEW.deal_id;
    ELSIF NEW.status = 'cancelled' THEN
        UPDATE deals SET status = 'on_air', updated_at = NOW() WHERE id = NEW.deal_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_deal_status
    AFTER INSERT OR UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_deal_status_on_transaction();