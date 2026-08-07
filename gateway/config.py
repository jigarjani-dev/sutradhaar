import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    openai_base_url: str = "https://api.deepseek.com/v1"
    openai_api_key: str = ""
    llm_model: str = "deepseek-chat"
    telegram_bot_token: str = ""
    google_credentials_file: str = ""
    mock_tools: bool = False
    data_dir: str = "/app/data"
    host: str = "0.0.0.0"
    port: int = 8080

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
