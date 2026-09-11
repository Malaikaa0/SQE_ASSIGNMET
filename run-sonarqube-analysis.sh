#!/bin/bash
# SonarQube Analysis Script for Library Administration System
# Baseline Version 1.0

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_DIR="/home/mbappe/SQE_Assignment-01/SQE_ASSIGNMET"
SONAR_SCANNER="/home/mbappe/sonar-scanner-5.0.1.3006-linux/bin/sonar-scanner"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  SonarQube Analysis - Baseline v1.0${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if SonarQube server is running
echo -e "${YELLOW}[1/5] Checking SonarQube server...${NC}"
if curl -s http://localhost:9000/api/system/status | grep -q "UP"; then
    echo -e "${GREEN}✓ SonarQube server is running${NC}"
else
    echo -e "${RED}✗ SonarQube server is NOT running${NC}"
    echo -e "${YELLOW}Please start SonarQube server first:${NC}"
    echo -e "  Option 1 (Docker): docker run -d --name sonarqube -p 9000:9000 sonarqube:latest"
    echo -e "  Option 2 (Manual): Start SonarQube from installation directory"
    echo ""
    echo -e "Then access: http://localhost:9000"
    echo -e "Default credentials: admin / admin"
    exit 1
fi

# Navigate to project directory
cd "$PROJECT_DIR"

# Verify baseline tag exists
echo -e "\n${YELLOW}[2/5] Verifying baseline tag...${NC}"
if git tag -l | grep -q "baseline-v1.0"; then
    echo -e "${GREEN}✓ Baseline tag 'baseline-v1.0' exists${NC}"
    git log --oneline -1 baseline-v1.0
else
    echo -e "${RED}✗ Baseline tag not found${NC}"
    exit 1
fi

# Check sonar-project.properties
echo -e "\n${YELLOW}[3/5] Checking SonarQube configuration...${NC}"
if [ -f "sonar-project.properties" ]; then
    echo -e "${GREEN}✓ sonar-project.properties found${NC}"
    echo -e "${BLUE}Project Key: $(grep sonar.projectKey sonar-project.properties | cut -d'=' -f2)${NC}"
else
    echo -e "${RED}✗ sonar-project.properties not found${NC}"
    exit 1
fi

# Install dependencies (if not already installed)
echo -e "\n${YELLOW}[4/5] Checking project dependencies...${NC}"
if [ ! -d "backend/node_modules" ]; then
    echo -e "${YELLOW}Installing backend dependencies...${NC}"
    cd backend && npm install && cd ..
fi
if [ ! -d "frontend/node_modules" ]; then
    echo -e "${YELLOW}Installing frontend dependencies...${NC}"
    cd frontend && npm install && cd ..
fi
echo -e "${GREEN}✓ Dependencies ready${NC}"

# Run SonarQube Scanner
echo -e "\n${YELLOW}[5/5] Running SonarQube Scanner...${NC}"
echo -e "${BLUE}This may take a few minutes...${NC}"
echo ""

if [ -x "$SONAR_SCANNER" ]; then
    "$SONAR_SCANNER" \
        -Dsonar.projectBaseDir="$PROJECT_DIR" \
        -Dsonar.working.directory="$PROJECT_DIR/.scannerwork"
    
    echo -e "\n${GREEN}========================================${NC}"
    echo -e "${GREEN}  Analysis Complete!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo -e "\n${BLUE}View results at:${NC} http://localhost:9000/dashboard?id=library-admin-system"
    echo ""
else
    echo -e "${RED}✗ SonarQube Scanner not found at: $SONAR_SCANNER${NC}"
    exit 1
fi
