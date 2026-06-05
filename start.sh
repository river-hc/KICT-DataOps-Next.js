#!/bin/bash

# KICT-DataOps 실행 스크립트
# Docker Compose를 사용하여 백엔드와 프론트엔드를 실행합니다.

set -e

echo "========================================"
echo "  KICT-DataOps 시작하기"
echo "========================================"

# Docker가 실행 중인지 확인
if ! command -v docker &> /dev/null; then
    echo "❌ Docker가 설치되어 있지 않습니다."
    echo "   Docker를 설치해주세요: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command -v docker-compose &> /dev/null & ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose가 설치되어 있지 않습니다."
    echo "   Docker Compose를 설치해주세요."
    exit 1
fi

# .env 파일 확인
if [ ! -f backend/.env ]; then
    echo "📝 .env 파일을 생성합니다..."
    cp backend/.env.example backend/.env
    echo "✅ backend/.env 파일이 생성되었습니다."
fi

# PostgreSQL 데이터 디렉토리 생성
if [ ! -d "postgres-data" ]; then
    mkdir -p postgres-data
    echo "📁 PostgreSQL 데이터 디렉토리를 생성했습니다."
fi

#runs 디렉토리 생성
if [ ! -d "runs" ]; then
    mkdir -p runs
    echo "📁 runs 디렉토리를 생성했습니다."
fi

echo ""
echo "🚀 서비스를 시작합니다..."
echo ""

# 서비스 실행
if docker compose version &> /dev/null; then
    docker compose -f docker-compose.yml up -d
else
    docker-compose -f docker-compose.yml up -d
fi

echo ""
echo "✅ 서비스가 시작되었습니다!"
echo ""
echo "📌 접속 정보:"
echo "   프론트엔드: http://localhost:8080"
echo "   백엔드 API: http://localhost:8002"
echo "   API 문서: http://localhost:8002/docs"
echo "   Nginx 프록시: http://localhost:8080"
echo ""
echo "📌 로그 확인: docker compose -f docker-compose.yml logs -f"
echo "📌 서비스 중지: docker compose -f docker-compose.yml down"
echo "========================================"