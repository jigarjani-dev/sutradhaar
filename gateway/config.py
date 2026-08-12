import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    openai_base_url: str = "https://api.deepseek.com/v1"
    openai_api_key: str = ""
    llm_model: str = "deepseek-chat"
    google_credentials_file: str = ""
    # Shared OAuth client identity (one Cloud project/app) -- Gmail and Sheets
    # each request their own scopes and keep their own token file below.
    google_client_secret_file: str = "/app/data/credentials/gmail_client_secret.json"
    gmail_token_file: str = "/app/data/credentials/gmail_token.json"
    sheets_token_file: str = "/app/data/credentials/sheets_token.json"
    mock_tools: bool = False
    data_dir: str = "/app/data"
    host: str = "0.0.0.0"
    port: int = 8080


settings = Settings()
