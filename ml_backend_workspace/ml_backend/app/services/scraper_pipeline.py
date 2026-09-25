import os
import time
import logging
import requests
import json
from bs4 import BeautifulSoup
from urllib.parse import urljoin

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AgriScraper:
    """Base class for all agricultural web scrapers."""
    def __init__(self, country: str, source_name: str, base_url: str):
        self.country = country
        self.source_name = source_name
        self.base_url = base_url
        self.output_dir = os.path.join(os.path.dirname(__file__), "..", "data", "documents")
        os.makedirs(self.output_dir, exist_ok=True)
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
        }

    def fetch(self, url: str) -> str:
        try:
            time.sleep(2)  # Polite crawling delay
            response = requests.get(url, headers=self.headers, timeout=15)
            response.raise_for_status()
            return response.text
        except Exception as e:
            logger.error(f"Error fetching {url}: {e}")
            return ""

    def save_document(self, title: str, content: str):
        # Clean title for filename
        clean_title = "".join(c if c.isalnum() else "_" for c in title)
        filename = f"{self.country}_{self.source_name}_{clean_title}.txt"
        filepath = os.path.join(self.output_dir, filename)
        
        # We prepend metadata for the RAG LLM to understand the context
        metadata = f"Source: {self.source_name}\nCountry: {self.country}\nTitle: {title}\n\n"
        
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(metadata + content)
        logger.info(f"Saved document: {filename}")

    def run(self):
        """To be implemented by specific scrapers."""
        raise NotImplementedError


class IndiaVikaspediaScraper(AgriScraper):
    """Scrapes crop production guidelines from India's Vikaspedia portal."""
    def __init__(self):
        super().__init__(
            country="India", 
            source_name="Vikaspedia", 
            base_url="https://vikaspedia.in/agriculture/crop-production"
        )

    def run(self):
        logger.info(f"Starting {self.country} scraper on {self.base_url}")
        html = self.fetch(self.base_url)
        if not html: return
        
        soup = BeautifulSoup(html, "html.parser")
        
        # Vikaspedia is a Next.js SPA. Data is stored in __NEXT_DATA__ JSON.
        script = soup.find("script", id="__NEXT_DATA__")
        if not script:
            logger.warning("Could not find __NEXT_DATA__ script tag. Site architecture may have changed.")
            return
            
        try:
            data = json.loads(script.string)
            content_list = data.get("props", {}).get("pageProps", {}).get("ssrContentList", [])
        except json.JSONDecodeError:
            logger.error("Failed to parse __NEXT_DATA__ JSON.")
            return

        logger.info(f"Found {len(content_list)} potential articles in the Next.js state.")
        
        # Limit to 5 for the pipeline demo
        for idx, item in enumerate(content_list[:5]):
            context_path = item.get("context_path")
            if not context_path: continue
            
            # The domain is hardcoded since context_path is relative
            url = f"https://vikaspedia.in{context_path}"
            logger.info(f"Scraping [{idx+1}/5]: {url}")
            
            article_html = self.fetch(url)
            if not article_html: continue
            
            article_soup = BeautifulSoup(article_html, "html.parser")
            article_script = article_soup.find("script", id="__NEXT_DATA__")
            
            if article_script:
                try:
                    article_data = json.loads(article_script.string)
                    page_content = article_data.get("props", {}).get("pageProps", {}).get("ssrPageContent", {})
                    
                    title = page_content.get("title", f"Article_{idx}")
                    html_content = page_content.get("content", "")
                    
                    # Convert HTML content to plain text
                    content_soup = BeautifulSoup(html_content, "html.parser")
                    text_content = content_soup.get_text(separator="\n\n", strip=True)
                    
                    if len(text_content) > 100:
                        self.save_document(title, text_content)
                except Exception as e:
                    logger.error(f"Error parsing article data for {url}: {e}")


class BrazilEmbrapaScraper(AgriScraper):
    """Scrapes agricultural research summaries from Brazil's Embrapa."""
    def __init__(self):
        super().__init__(
            country="Brazil", 
            source_name="Embrapa", 
            base_url="https://www.embrapa.br/en/pesquisa-e-desenvolvimento"
        )
        
    def run(self):
        # Implementation left as an architecture example for extending to BRICS
        logger.info(f"Starting {self.country} scraper on {self.base_url}")
        # Add fetching logic specific to Embrapa's DOM structure here...
        self.save_document("Brazil_Soybean_Research_Mock", "Brazil's Embrapa indicates that soybean rust can be mitigated using specific fungicidal rotations adapted for the Cerrado biome.")

class ChinaMARAScraper(AgriScraper):
    """Ministry of Agriculture and Rural Affairs of the People's Republic of China"""
    def __init__(self):
        super().__init__(country="China", source_name="MARA", base_url="http://english.moa.gov.cn/")
        
    def run(self):
        logger.info(f"Starting {self.country} scraper on {self.base_url}")
        # Add MARA specific scraping logic
        self.save_document("China_Wheat_Guidelines_Mock", "MARA recommends early spring irrigation in the North China Plain to boost winter wheat yields during dry spells.")

if __name__ == "__main__":
    logger.info("Starting BRICS Agricultural Data Scraping Pipeline...")
    
    scrapers = [
        IndiaVikaspediaScraper(),
        BrazilEmbrapaScraper(),
        ChinaMARAScraper()
    ]
    
    for scraper in scrapers:
        scraper.run()
        
    logger.info("Pipeline execution complete. Data saved to documents folder.")
