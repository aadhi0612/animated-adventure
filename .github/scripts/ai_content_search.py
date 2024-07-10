# .github/scripts/ai_content_search.py
import sys
import requests
from bs4 import BeautifulSoup
import feedparser
from datetime import datetime

def fetch_google_news_rss(topic):
    topic = topic.replace(' ', '+')
    print(f"Fetching news via RSS for topic: {topic}")
    url = f'https://news.google.com/rss/search?q={topic}&hl=en-US&gl=US&ceid=US:en'
    feed = feedparser.parse(url)
    articles = []
    for entry in feed.entries[:10]:
        published = datetime.strptime(entry.published, '%a, %d %b %Y %H:%M:%S %Z')
        article = {
            'title': entry.title,
            'link': entry.link,
            'source': 'Google News',
            'published': published.strftime('%B %d, %Y'),
            'summary': entry.summary,
            'image_url': 'default_image.jpg'  # Placeholder for an image URL
        }
        articles.append(article)
    return articles

def fetch_medium(tag): 
    tag = tag.replace(' ', '-')
    print(f"Fetching Medium articles for tag: {tag}")
    url = f'https://medium.com/tag/{tag}/latest'
    response = requests.get(url)
    soup = BeautifulSoup(response.text, 'html.parser')
    articles = []
    for article in soup.select('.postArticle'):  # Adjust the selector based on actual page structure
        title = article.find('h3')
        if title:
            link = article.find_parent('a', href=True)
            summary = article.find('h4') or 'No summary available'
            image = article.find('img')  # Finding an image in the article
            image_url = image['src'] if image else 'default_image.jpg'  # Placeholder or default image
            article_data = {
                'title': title.get_text(strip=True),
                'link': f'https://medium.com{link["href"]}' if link else '#',
                'summary': summary.get_text(strip=True) if summary else 'No summary available',
                'image_url': image_url
            }
            articles.append(article_data)
    return articles

def update_readme(articles):
    print("Updating README with new content")
    with open('README.md', 'w') as file:
        for article in articles:
            file.write(f"![Image]({article['image_url']})\n")  # Embedding image
            file.write(f"[{article['title']}]({article['link']}) - {article['summary']}\n\n")

if __name__ == "__main__":
    topic = sys.argv[1]
    tag = sys.argv[2]
    google_articles = fetch_google_news_rss(topic)
    medium_articles = fetch_medium(tag)
    update_readme(google_articles + medium_articles)
