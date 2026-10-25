-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  credits INTEGER DEFAULT 0,
  total_generations INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Wallpapers table
CREATE TABLE public.wallpapers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  fingerprint TEXT, -- For anonymous users
  image_url TEXT NOT NULL,
  prompt TEXT,
  nakshatra TEXT,
  resolution TEXT DEFAULT '1080x1920',
  chart_data JSONB,
  report_data JSONB,
  regional_system TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transactions table
CREATE TABLE public.transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- in paise
  credits_added INTEGER NOT NULL,
  status TEXT CHECK (status IN ('pending', 'completed', 'failed')) DEFAULT 'pending',
  payment_method TEXT,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  razorpay_signature TEXT,
  upi_transaction_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Generation usage for anonymous users
CREATE TABLE public.generation_usage (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  fingerprint TEXT UNIQUE NOT NULL,
  count INTEGER DEFAULT 0,
  last_generated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallpapers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_usage ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own wallpapers" ON public.wallpapers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own wallpapers" ON public.wallpapers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own wallpapers" ON public.wallpapers FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS 
BEGIN
  INSERT INTO public.profiles (id, email, credits)
  VALUES (NEW.id, NEW.email, 1); -- 1 bonus credit on signup
  RETURN NEW;
END;
 LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Indexes
CREATE INDEX idx_wallpapers_user_id ON public.wallpapers(user_id);
CREATE INDEX idx_wallpapers_created_at ON public.wallpapers(created_at DESC);
CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_generation_usage_fingerprint ON public.generation_usage(fingerprint);

-- Add this function to handle credit addition atomically
CREATE OR REPLACE FUNCTION public.add_credits(user_id UUID, credits_to_add INTEGER)
RETURNS VOID AS 
BEGIN
  UPDATE public.profiles
  SET credits = credits + credits_to_add,
      updated_at = NOW()
  WHERE id = user_id;
END;
 LANGUAGE plpgsql SECURITY DEFINER;
