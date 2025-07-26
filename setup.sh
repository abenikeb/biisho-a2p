#!/bin/bash

echo "🚀 Setting up Biisho A2P SMS Platform Backend (TypeScript)..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please update the .env file with your database credentials and other settings."
fi

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Build TypeScript
echo "🔨 Building TypeScript..."
npm run build

# Check if database is accessible
echo "🗄️  Checking database connection..."
if npx prisma db push --accept-data-loss; then
    echo "✅ Database connection successful!"
    
    # Seed demo data
    echo "🌱 Seeding demo data..."
    npm run seed
    
    echo "🎉 Setup completed successfully!"
    echo ""
    echo "Demo credentials:"
    echo "Admin: admin@biisho.com / admin123"
    echo "Customer: customer@example.com / password"
    echo ""
    echo "To start the development server, run: npm run dev"
    echo "To start the production server, run: npm start"
else
    echo "❌ Database connection failed. Please check your DATABASE_URL in .env file."
    exit 1
fi
