#!/bin/bash
# Copilot Shim Service Management Script
# Usage: ./scripts/service.sh [start|stop|restart|status|logs|install]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SERVICE_NAME="copilot-shim"
WSL_DISTRO="Ubuntu-22.04"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check if PM2 is installed
check_pm2() {
    if ! command -v pm2 &> /dev/null; then
        echo -e "${RED}PM2 is not installed.${NC}"
        echo "Install it with: npm install -g pm2"
        exit 1
    fi
}

# Ensure project is built
ensure_built() {
    if [ ! -d "$PROJECT_DIR/dist" ]; then
        echo -e "${YELLOW}Building project...${NC}"
        cd "$PROJECT_DIR" && npm run build
    fi
}

# Create logs directory
ensure_logs_dir() {
    mkdir -p "$PROJECT_DIR/logs"
}

case "$1" in
    start)
        check_pm2
        ensure_built
        ensure_logs_dir
        echo -e "${BLUE}Starting $SERVICE_NAME...${NC}"
        cd "$PROJECT_DIR" && pm2 start ecosystem.config.js
        echo -e "${GREEN}Service started.${NC}"
        pm2 status "$SERVICE_NAME"
        ;;

    stop)
        check_pm2
        echo -e "${BLUE}Stopping $SERVICE_NAME...${NC}"
        pm2 stop "$SERVICE_NAME" 2>/dev/null || echo "Service was not running"
        echo -e "${GREEN}Service stopped.${NC}"
        ;;

    restart)
        check_pm2
        ensure_built
        ensure_logs_dir
        echo -e "${BLUE}Restarting $SERVICE_NAME...${NC}"
        pm2 restart "$SERVICE_NAME" 2>/dev/null || (cd "$PROJECT_DIR" && pm2 start ecosystem.config.js)
        echo -e "${GREEN}Service restarted.${NC}"
        pm2 status "$SERVICE_NAME"
        ;;

    status)
        check_pm2
        pm2 status "$SERVICE_NAME"
        echo ""
        echo -e "${BLUE}Health check:${NC}"
        curl -s http://localhost:4891/health 2>/dev/null | jq . || echo "Service not responding"
        ;;

    logs)
        check_pm2
        pm2 logs "$SERVICE_NAME" --lines 50
        ;;

    logs-follow)
        check_pm2
        pm2 logs "$SERVICE_NAME"
        ;;

    install)
        echo -e "${BLUE}Installing PM2 globally...${NC}"
        npm install -g pm2

        echo -e "${BLUE}Building project...${NC}"
        cd "$PROJECT_DIR" && npm run build

        ensure_logs_dir

        echo -e "${BLUE}Starting service with PM2...${NC}"
        cd "$PROJECT_DIR" && pm2 start ecosystem.config.js

        echo -e "${BLUE}Saving PM2 process list...${NC}"
        pm2 save

        echo ""
        echo -e "${GREEN}Installation complete!${NC}"
        echo ""
        echo "To enable auto-start on WSL2 startup, add this to your Windows Task Scheduler:"
        echo ""
        echo "  Program: wsl.exe"
        echo "  Arguments: -d $WSL_DISTRO -u $USER -- bash -lc 'pm2 resurrect'"
        echo ""
        echo "Or run: ./scripts/service.sh setup-autostart"
        ;;

    setup-autostart)
        check_pm2
        echo -e "${BLUE}Setting up PM2 startup...${NC}"

        # Save current process list
        pm2 save

        # Generate startup script info
        echo ""
        echo -e "${GREEN}PM2 process list saved.${NC}"
        echo ""
        echo "To auto-start on Windows boot, create a Task Scheduler task:"
        echo ""
        echo "  1. Open Task Scheduler (taskschd.msc)"
        echo "  2. Create Basic Task: 'Copilot Shim'"
        echo "  3. Trigger: 'When I log on'"
        echo "  4. Action: Start a program"
        echo "     Program: wsl.exe"
        echo "     Arguments: -d $WSL_DISTRO -u $USER -- bash -lc 'cd $PROJECT_DIR && pm2 resurrect'"
        echo "  5. Check 'Open Properties dialog' and set:"
        echo "     - Run whether user is logged on or not: NO (uncheck)"
        echo "     - Run only when user is logged on: YES"
        echo ""
        echo "This ensures the service starts with your Windows session and can show"
        echo "the browser window if login is needed."
        ;;

    uninstall)
        check_pm2
        echo -e "${BLUE}Stopping and removing service...${NC}"
        pm2 stop "$SERVICE_NAME" 2>/dev/null
        pm2 delete "$SERVICE_NAME" 2>/dev/null
        pm2 save
        echo -e "${GREEN}Service removed.${NC}"
        ;;

    *)
        echo "Copilot Shim Service Manager"
        echo ""
        echo "Usage: $0 {start|stop|restart|status|logs|logs-follow|install|setup-autostart|uninstall}"
        echo ""
        echo "Commands:"
        echo "  start          Start the service"
        echo "  stop           Stop the service"
        echo "  restart        Restart the service"
        echo "  status         Show service status and health"
        echo "  logs           Show recent logs"
        echo "  logs-follow    Follow logs in real-time"
        echo "  install        Install PM2 and set up the service"
        echo "  setup-autostart Show instructions for auto-start on boot"
        echo "  uninstall      Remove the service from PM2"
        exit 1
        ;;
esac
