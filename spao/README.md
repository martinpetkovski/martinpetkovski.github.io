# Информации

**Демонстратор:** [Мартин Петковски](https://www.najjak.com/spao/martin-petkovski-cv.pdf)  (petkovski.martin@uklo.edu.mk)

**&#xf017; Термин:** Секој вторник од 17:00 до 18:30 

**&#xf1a0; Линк:**  https://meet.google.com/txh-ojfe-opi

**&#xf392; Дискорд:** https://discord.gg/mrNnKgbSCQ

### Потребен софтвер

[&#xf019; MySQL Server](https://dev.mysql.com/downloads/file/?id=508935) (GPL)

[&#xf019; MySQL Workbench](https://dev.mysql.com/downloads/workbench/) (GPL)


---

# 09.11.2021 - Запознавање и вовед
 [&#xf1c4; PowerPoint презентација](https://www.najjak.com/spao/resources/spao-vezhbi-01.pptx).

---

# 16.11.2021 - Star Schema

### Задачи

#### 01
Во една онлајн продавница можете да нарачате продукти од различен тип. 

Таа онлајн продавница чува податоци со различни компоненти за своите: 
- продажби (**Sales**)
- муштерии (**Customers**)
- продукти (**Products**) 
- вработени (**Employees**). 

Овие компоненти дополнително содржат податоци за: **SaleID, SalePerson, SaleAmount, CustomerDimID, CustomerID, Phone, Address, CustomerName, City, State, Country, ProductDimID, ProductID, ProductName, Category, Description, EmployeeDimID, EmployeeID, FirstName, LastName, Status, Manager, DateDimID, DateID, Date, Month, Quarter, Year, IsHoliday.**

Конструирајте star schema од дадените податоци.

[&#xf019; Workbench решение](https://www.najjak.com/spao/resources/Vezhbi02_Zadacha01.mwb)

[&#xf03e; Слика од шемата](https://www.najjak.com/spao/resources/Vezhbi02_Zadacha01.png)

#### 02
Во онлајн продавницата на Steam можете да купите и играте видео игри. 

Steam чува податоци со различни компоненти за: 
- достигнувања на играчите (**Achievements**)
- играчи (**Players**)
- игри (**Games**)
- партнери (**Partners**)

Овие компоненти дополнително содржат податоци и за: **AchievementID, AchievementName, AchievementTime, AchievementImageUrl, PlayerDimID, PlayerID, Nickname, PlayerDescription, PlayerImageUrl, PlayerCreationDate, GameDimID, GameID, GameName, GameDescription, GameImageUrl, PartnerDimID, PartnerID, PartnerName, PartnerCreationDate, DateDimID, DateID, Date, Month, Year, IsSale.**

Конструирајте star schema од дадените податоци.

[&#xf019; Workbench решение](https://www.najjak.com/spao/resources/Vezhbi02_Zadacha02.mwb)

[&#xf03e; Слика од шемата](https://www.najjak.com/spao/resources/Vezhbi02_Zadacha02.png)

---

# 23.11.2021 - Колоквиумска Недела 🥳

---

# 30.11.2021 - Snowflake Schema

### Задачи

#### 03

Во една компанија за продажба на хартија можете да нарачате одредена количина на листови хартија.

Компанијата чува податоци за:
- Приход (**Revenue**)
- Продукт (**Product**)
- Филијала (**Branch**)
- Муштерија (**Customer**)
- Датум (**Date**)

Овие компоненти дополнително содржат податоци за: **RevenueID, UnitsSold, RevenueAmount, CustomerID, CustomerName, CustomerPhoneNumber, LocationID, Region, CountryID, CountryName, BranchID, BranchName, BranchAddress, ProductID, ProductName, VariantID, VariantName, VariantTreeType, DateID, Year, Month, Quarter, Date**

Конструирајте snowflake schema од дадените податоци.

[&#xf019; Workbench решение](https://www.najjak.com/spao/resources/Vezhbi03_Zadacha03.mwb)

[&#xf03e; Слика од шемата](https://www.najjak.com/spao/resources/Vezhbi03_Zadacha03.png)

#### 04

Една авиокомпанија управува со летови помеѓу различни градови во светот.

Компанијата чува податоци за:
- Приход (**Revenue**)
- Летови (**Flights**)
- Пилоти (**Pilots**)
- Датум  (**Date**)

Овие компоненти дополнително содржат податоци за: **RevenueID, FuelSpent, PassengersTransported, RevenueAmount, FlightID, FlightFromID, FlightToID, FlightTime, CityID, Country, CitySize, PilotID, PilotName, PilotNationality PilotTotalHoursFlight, DateID, Year, Month, Quarter, Date**

Конструирајте snowflake schema од дадените податоци.

#### Решенија:

| Студент | Workbench | Слика |
|---------|-----------|-------|
|**Владимир Павловски**|[&#xf019; Симни](https://www.najjak.com/spao/resources/VladimirPavlovski_Zadacha03.mwb)|[&#xf03e; Отвори](https://www.najjak.com/spao/resources/VladimirPavlovski_Vezhbi03_Zadacha03.png)|
|**Антонио Ристевски**| [&#xf019; Симни](https://www.najjak.com/spao/resources/AntonioRistevski_Zadacha03.mwb)|[&#xf03e; Отвори](https://www.najjak.com/spao/resources/AntonioRistevski_Vezhbi03_Zadacha03.png)

#### 05

Во онлајн продавницата на Steam можете да купите и играте видео игри. 

Steam чува податоци со различни компоненти за: 
- достигнувања на играчите (**Achievements**)
- играчи (**Players**)
- игри (**Games**)
- партнери (**Partners**)

Овие компоненти дополнително содржат податоци и за: **AchievementID, AchievementName, AchievementTime, AchievementImageUrl, PlayerID, Nickname, PlayerDescription, PlayerImageUrl, PlayerCreationDate, CountryID, CountryName, CountryTimeZone, GameID, GameName, GameDescription, GameImageUrl, DeveloperID, DeveloperName, DeveloperLocation, PublisherID, PublisherName, PublisherCountry, PublisherCreationDate, DateID, Date, Month, Year, IsSale.**

Конструирајте snowflake schema од дадените податоци.

### Решенија:

++