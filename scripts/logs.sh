#!/bin/bash

# Reality Engine - Logs Viewer
# Shows logs from various services

SERVICE=${1:-all}
LINES=${2:-50}

echo "=================================================="
echo "Reality Engine - Logs Viewer"
echo "=================================================="
echo ""

case $SERVICE in
    api)
        echo "Showing Reality Engine API logs (last $LINES lines):"
        echo ""
        if [ -f logs/api.log ]; then
            tail -n $LINES logs/api.log
        else
            echo "No API logs found"
        fi
        ;;

    qdrant)
        echo "Showing Qdrant logs (last $LINES lines):"
        echo ""
        docker-compose logs --tail=$LINES qdrant
        ;;

    all)
        echo "=== Reality Engine API Logs ==="
        echo ""
        if [ -f logs/api.log ]; then
            tail -n 20 logs/api.log
        else
            echo "No API logs found"
        fi

        echo ""
        echo ""
        echo "=== Qdrant Logs ==="
        echo ""
        docker-compose logs --tail=20 qdrant
        ;;

    follow)
        echo "Following all logs (Ctrl+C to exit)..."
        echo ""
        tail -f logs/api.log &
        API_TAIL_PID=$!
        docker-compose logs -f qdrant &
        QDRANT_TAIL_PID=$!

        trap "kill $API_TAIL_PID $QDRANT_TAIL_PID 2>/dev/null; exit 0" INT
        wait
        ;;

    *)
        echo "Usage: ./scripts/logs.sh [service] [lines]"
        echo ""
        echo "Services:"
        echo "  api       - Reality Engine API logs"
        echo "  qdrant    - Qdrant database logs"
        echo "  all       - All logs (default)"
        echo "  follow    - Follow logs in real-time"
        echo ""
        echo "Lines: Number of lines to show (default: 50)"
        echo ""
        echo "Examples:"
        echo "  ./scripts/logs.sh api 100"
        echo "  ./scripts/logs.sh qdrant"
        echo "  ./scripts/logs.sh follow"
        ;;
esac

echo ""
