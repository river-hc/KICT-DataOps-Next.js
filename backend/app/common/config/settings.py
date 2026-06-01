from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "KICT DataOps Training Platform"
    app_env: str = "local"

    database_url: str

    runs_dir: str = "./runs"
    trainer_dir: str = "./trainer"

    max_concurrent_jobs: int = 1

    class Config:
        env_file = ".env"


settings = Settings()