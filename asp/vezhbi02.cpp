#include<iostream>
#include<vector>
#include<queue>
#include<string>
using std::cout;
using std::endl;
using std::string;

int linearno_prebaruvanje(int niza[], int n, int kluch)
{
	for (int i = 0; i < n; i++)
		if (niza[i] == kluch)
			return i;
	return -1;
}

int binarno_prebaruvanje_recursive(int niza[], int n_max, int kluch, int n_min = 0)
{
	if (n_max < n_min)
		return -1;
	else
	{
		int sredina = (n_max + n_min) / 2;

		if (niza[sredina] > kluch)
			return binarno_prebaruvanje_recursive(niza, sredina - 1, kluch, n_min);
		else if (niza[sredina] < kluch)
			return binarno_prebaruvanje_recursive(niza, n_max, kluch, sredina + 1);
		else
			return sredina;
	}
}

int binarno_prebaruvanje_iterative(int niza[], int n_max, int kluch)
{
	int n_min = 0;

	while (n_max >= n_min)
	{
		int sredina = (n_min + n_max) / 2;
		if (niza[sredina] == kluch)
			return sredina;
		else if (niza[sredina] < kluch)
			n_min = sredina + 1;
		else
			n_max = sredina - 1;
	}
	return -1;
}

///////////////////////////////////////////
///////////////////////////////////////////

void pechati_adresi_na_elementi_na_niza(int *niza, int n)
{
	for (int i = 0; i < n; i++)
		cout << &niza[i] << endl;

	system("pause");
	cout << sizeof(int);
	system("pause");
}

int pristapi_do_element(int *niza, int n)
{
	niza += n;
	cout << niza << endl;
	return *niza;
}

/////////////////////////////////////////////
/////////////////////////////////////////////

struct stack
{
	int maxsize;
	int top;
	int *items;

	stack() {};
};

void stack_initialize(stack *stk, int size)
{
	stk->top = 0;
	stk->items = new int[size];
	stk->maxsize = size;
}

void stack_push(stack *stk, int item)
{
	if (stk->top == stk->maxsize)
		cout << "buffer overflow" << endl;
	else
	{
		stk->items[stk->top] = item;
		stk->top++;
	}
}

int stack_pop(stack *stk)
{
	if (stk->top == 0)
		cout << "buffer underflow" << endl;
	else
	{
		stk->top--;
		return stk->items[stk->top];
	}
}

int stack_top(stack *stk)
{
	return stk->items[stk->top - 1];
}

/////////////////////////////////////////////
/////////////////////////////////////////////

struct queue
{
	int maxsize;
	int top;
	int *items;

	queue() { };
};

void queue_initialize(queue *q, int size)
{
	q->maxsize = size;
	q->top = 0;
	q->items = new int[size];
}

void queue_push(queue *q, int item)
{
	if (q->top == q->maxsize)
		cout << "buffer overflow" << endl;
	else
	{
		q->items[q->top] = item;
		q->top++;
	}
}

void array_shift_left(int *arr, int start, int end)
{
	for (int i = start; i < end - 1; i++)
		arr[i] = arr[i + 1];
}

void queue_pop(queue *q)
{
	array_shift_left(q->items, 0, q->top);
	q->top--;
}

int queue_front(queue *q)
{
	return q->items[0];
}

int queue_back(queue *q)
{
	return q->items[q->top - 1];
}

/////////////////////////////////////////////
/////////////////////////////////////////////

/*
************************************
* ЕДИНЕЧНО ПОВРЗАНА ЛИСТА *
************************************
*/

// структура за елементите на листата
struct Item
{
	// клуч и покажувач кон следниот елемент
	string key;
	Item * next;
};

// класа која ги содржи функционалностите на поврзаната листа
class LinkedList
{
private:
	Item * head; // референца (мемориска локација) кон листа на податочни темиња (елементи)
	int length; // променлива во која се чува должината на листата

public:
	LinkedList(); // конструктор
	void insert_item(Item * newItem); // вметнување на нов елемент на крајот на листата
	bool remove_item(string itemKey); // бришење на елемент со одреден клуч
	Item * get_item(string itemKey); // селектирање на елемент со одреден клуч
	void print_list(); // печатење на целосната листа
	int get_length(); // должина на листата
	~LinkedList(); // деструктор
};

// конструктор
LinkedList::LinkedList()
{
	head = new Item; // динамичка алокација на нов елемент кој ќе биде почетен елемент на листата
	head->next = nullptr; // првиот елемент добива вредност nullptr (null покажувач)
	length = 0; // должината се иницијализира на 0
}

// вметнување на нов елемент
void LinkedList::insert_item(Item * newItem)
{
	if (!head->next) // ако првиот елемент нема следен елемент
	{
		head->next = newItem; // новиот елемент се вметнува после првиот елемент
		length++; // должината на листата се зголемува за 1
		return; // прекин на функцијата
	}
	Item * p = head; // помошна променлива
	Item * q = head; // помошна променлива
	while (q) // итерирање низ елементите се дури q не е покажувач кон nullptr
	{
		p = q;
		q = p->next;
	} // кога циклусот прекинува во p го имаме последниот елемент
	p->next = newItem; // елементот после p (последниот елемент) е новиот елемент кој сакаме да во вметнеме
	newItem->next = nullptr; // покажувачот на последниот елемент е кон nullptr
	length++; // должината на листата се зголемува за 1
}

// бришење на елемент со даден клуч
bool LinkedList::remove_item(string itemKey)
{
	if (!head->next) return false; // ако листата нема елементи врати false (елементот не постои)
	Item * p = head; // помошна променилва
	Item * q = head; // помошна променлива
	while (q) // се додека вредноста на елементот q не е null
	{
		if (q->key == itemKey) // ако вредноста на клучот на q е идентична со клучот кој се бара
		{
			p->next = q->next;  // „одкачување“ на елементот од поврзаната листа
			delete q; // бришење на елементот
			length--; // должината на листата се намалува за еден
			return true; // успешно извршена операција
		}
		p = q; // замена на местата на помошните промениви
		q = p->next; // следната итерација низ листата
	}
	return false; // неуспешно извршена операција (елементот не постои)
}

// врати го елементот со одреден клуч
Item * LinkedList::get_item(string itemKey)
{
	Item * p = head; // помошна променлива
	Item * q = head; // помошна променлива
	while (q) // се додека не стигниме до последниот елемент (null)
	{
		p = q; // помош при итерацијата низ елементите
		if ((p != head) && (p->key == itemKey)) // ако разгледуваниот елемент од листата не е првиот(главата) и неговиот клуч е еднаков со клучот кој се бара
			return p; // врати го разгледуваниот елемент (од итерацијата)
		q = p->next; // ако функцијата не заврши q покажува кон следниот елемент
	}
	return nullptr; // ако функцијата заврши без да се врати некаков елемент елементот не постои (nullptr)
}

// печатење на листата
void LinkedList::print_list()
{
	if (length == 0)
	{
		cout << "\n{ }\n";
		return;
	}
	Item * p = head;
	Item * q = head;
	cout << "\n{ ";
	while (q)
	{
		p = q;
		if (p != head)
		{
			cout << p->key;
			if (p->next) cout << ", ";
			else cout << " ";
		}
		q = p->next;
	}
	cout << "}\n";
}

// земи ја должината на листата
int LinkedList::get_length()
{
	return length;
}

// деструктор
LinkedList::~LinkedList()
{
	Item * p = head; // помошна променлива
	Item * q = head; // помошна променлива
	while (q) // се додека не стигниме до крајот на листата (null елемент)
	{
		p = q; // помошната променлива p ја иницијализираме на q
		q = p->next; // q е покажувач до следниот елемент
		if (q) delete p; // ако елементот постои, избриши го
	}
}

/*
************************************
* ХЕШИРАЊЕ *
************************************
*/

// класа која ги содржи функциионалностите на Хеш табела
class HashTable
{
private:
	LinkedList * array; // покажувач до поврзана листа која ќе ја игра улогата на closed bucket
	int length; // должина на хеш табелата (m)
	int hash(string itemKey); // хеш функција

public:
	HashTable(int tableLength = 13); // конструктор
	void insert_item(Item * newItem); // вметнување на елемент во хеш табелата
	bool remove_item(string itemKey); // бришење на елемент од хеш  табелата
	Item * get_item_by_key(string itemKey); // селектирање на елемент по клуч
	void print_table(); // печатење на хеш табелата
	void print_histogram(); // печатење на хистограм на хеш табелата
	int get_length(); // печатење на должина на хеш табелата
	int get_number_of_items(); // печатење на должина на елементи на хеш табелата
	~HashTable(); // деструктор
};

// конструктор
HashTable::HashTable(int tableLength)
{
	if (tableLength <= 0) tableLength = 42; // должината дифолтнува на 42
	array = new LinkedList[tableLength]; // должината се однесува на секоја кофичка
	length = tableLength; // должината која ја бараме е и големината на хеш табелата
}

////////////////////////////////////////
// !!!!!!!!!! хеш функција !!!!!!!!!! //
////////////////////////////////////////

// се пресметува збирот на вресностите на ASCII кодовите на
// сите букви во клучот. Добиениот број се множи до бројот
// на букви во клучот и се бара mod со должината на хеш табелата.
// Зошто? - За секоја комбинација на букви и должини се добива
// различна нумеричка вредност (различна кофичка). Колку е подобра
// дистрибуцијата на клучевите во кофичките толку е помало заситувањето
// толку е подобра функцијата за хеширање. На крајот се бара Mod
// бидејќи Mod ќе врати број во опсег 0 - максимален број на елементи
// во самата хеш табела (не во кофичката).
int HashTable::hash(string itemKey)
{
	int value = 0; // збирот на ASCII вредностите на буквите се иницијализира на 0
	for (int i = 0; i < itemKey.length(); i++) // се додека не се стигне до крајот на клучот
		value += itemKey[i]; // вредноста се зголемува за ASCII вредноста на буквата на местото на вредноста на итераторот
	return (value * itemKey.length()) % length; // пресметка за индексот објаснета погоре
}

// вметнување на нов елемент во хеш табелата
void HashTable::insert_item(Item * newItem)
{
	int index = hash(newItem->key); // индексот се добива од хеш функцијата
	array[index].insert_item(newItem); // вметнување на новиот елемент на индексот добиен од хеш функцијата (array е од тип LinkedList)
}

bool HashTable::remove_item(string itemKey)
{
	int index = hash(itemKey); // индексот се добива од хеш функцијата
	return array[index].remove_item(itemKey); // бришење на елементот на индексот добиен од хеш функцијата
}

Item * HashTable::get_item_by_key(string itemKey)
{
	int index = hash(itemKey); // индексот се добива од хеш функцијата
	return array[index].get_item(itemKey); // селектирање на елемент на индексот добиен од хеш функцијата
										   // во интерес е да има помалку елементи во поврзаната листа бидејќи тогаш get_item ќе напрај помалку итерации
}

// Печатење на табелата
void HashTable::print_table()
{
	cout << "\n\nHash tabela:\n";
	for (int i = 0; i < length; i++)
	{
		cout << "Kofichka " << i + 1 << ": ";
		array[i].print_list();
	}
}

// Печатење на хистограм
void HashTable::print_histogram()
{
	cout << "\n\nHash tabelata sodrzhi ";
	cout << get_number_of_items() << " elementi vkupno\n";
	for (int i = 0; i < length; i++)
	{
		cout << i + 1 << ":\t";
		for (int j = 0; j < array[i].get_length(); j++)
			cout << " X";
		cout << "\n";
	}
}

// врати ја должината на хеш табелата
int HashTable::get_length()
{
	return length;
}

// врати број на елементи во секоја кофичка
int HashTable::get_number_of_items()
{
	int itemCount = 0;
	for (int i = 0; i < length; i++)
	{
		itemCount += array[i].get_length();
	}
	return itemCount;
}

// деструктор на хаш табела
HashTable::~HashTable()
{
	delete[] array; // се бриши динамички алоцираната низа во конструкторот
}

void main()
{

	//	int niza[8] = { 5, 4, 6, 3, 7, 2, 8, 1 };

	//	pechati_adresi_na_elementi_na_niza(niza, 8);
	//	cout << pristapi_do_element(niza, 7) << endl;

	/*

	stack stk1;
	stack_initialize(&stk1, 4);
	stack_pop(&stk1); // underflow
	stack_push(&stk1, 1); // 0
	stack_push(&stk1, 2); // 1
	stack_push(&stk1, 3); // 2
	stack_push(&stk1, 4); // 3
	stack_push(&stk1, 5); // overflow
	stack_push(&stk1, 6); // overflow
	cout << stack_pop(&stk1) << endl; // 4
	cout << stack_pop(&stk1) << endl; // 3
	cout << stack_top(&stk1) << endl; // 2

	*/

	/*

	std::vector<int> stack;
	//	stack.pop_back(); // UNDERFLOW!
	stack.push_back(1);
	stack.push_back(2);
	stack.push_back(3);
	stack.push_back(4);
	stack.push_back(5);
	stack.push_back(6);
	stack.pop_back();
	stack.pop_back();
	cout<<stack.back(); // 4

	*/

	/*

	queue q1;
	queue_initialize(&q1, 4);
	queue_push(&q1, 1);
	queue_push(&q1, 2);
	queue_push(&q1, 3);
	queue_push(&q1, 4);
	queue_pop(&q1);
	cout << queue_front(&q1) << endl; // 2
	queue_push(&q1, 5);
	queue_pop(&q1);
	cout << queue_front(&q1) << endl; // 3

	*/

	/*

	std::queue<int> q2;
	q2.push(1);
	q2.push(2);
	q2.push(3);
	q2.push(4);
	q2.pop();
	cout << q2.front() << endl; // 2
	q2.push(5);
	q2.pop();
	cout << q2.front() << endl; // 3

	*/

	/*

	Item * A = new Item{ "Earthshaker", NULL };
	Item * B = new Item{ "Sven", NULL };
	Item * C = new Item{ "Tiny", NULL };
	Item * D = new Item{ "Beastmaster", NULL };
	Item * E = new Item{ "Tidehunter", NULL };
	Item * F = new Item{ "Lifestealer", NULL };
	Item * G = new Item{ "Spirit Breaker", NULL };
	Item * H = new Item{ "Treant Protector", NULL };
	Item * I = new Item{ "Earth Spirit", NULL };
	Item * J = new Item{ "Drow Ranger", NULL };
	Item * K = new Item{ "Juggernaut", NULL };
	Item * L = new Item{ "Bloodseeker", NULL };
	Item * M = new Item{ "Phantom Assassin", NULL };
	Item * N = new Item{ "Sniper", NULL };
	Item * O = new Item{ "Luna", NULL };
	Item * P = new Item{ "Bounty Hunter", NULL };
	Item * Q = new Item{ "Ursa", NULL };
	Item * R = new Item{ "Crystal Maiden", NULL };
	Item * S = new Item{ "Lich", NULL };
	Item * T = new Item{ "Zeus", NULL };
	Item * U = new Item{ "Lina", NULL };
	Item * V = new Item{ "Nature's Prophet", NULL };
	Item * W = new Item{ "Tinker", NULL };
	Item * X = new Item{ "Invoker", NULL };
	Item * Y = new Item{ "Shadow Demon", NULL };
	Item * Z = new Item{ "Enigma", NULL };

	HashTable table;

	table.insert_item(A);
	table.insert_item(B);
	table.insert_item(C);
	table.print_table();
	table.print_histogram();

	system("pause");
	system("cls");

	table.remove_item("Sven");
	table.print_table();
	table.print_histogram();

	system("pause");
	system("cls");

	table.insert_item(D);
	table.insert_item(E);
	table.insert_item(F);
	table.insert_item(G);
	table.insert_item(H);
	table.insert_item(I);
	table.insert_item(J);
	table.insert_item(K);
	table.insert_item(L);
	table.insert_item(M);
	table.insert_item(N);
	table.insert_item(O);
	table.insert_item(P);
	table.insert_item(Q);
	table.insert_item(R);
	table.insert_item(S);
	table.insert_item(T);
	table.insert_item(U);
	table.insert_item(V);
	table.insert_item(W);
	table.insert_item(X);
	table.insert_item(Y);
	table.insert_item(Z);
	table.print_table();
	table.print_histogram();

	system("pause");
	system("cls");

	Item * result = table.get_item_by_key("Zeus");
	cout << result->key << endl;

	*/
	cout << endl;
	system("pause");
}