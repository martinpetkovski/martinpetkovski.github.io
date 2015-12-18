#include &lt;stdio.h&gt;
#include &lt;stdlib.h&gt;

struct node
{
	string data;
	struct node* left;
	struct node* right;
};


struct node* newNode(string data)
{
	struct node* node = (struct node*)
		malloc(sizeof(struct node));
	node-&gt;data = data;
	node-&gt;left = NULL;
	node-&gt;right = NULL;

	return(node);
}


void print_postorder(struct node* node)
{
	if (node == NULL)
		return;

	printPostorder(node-&gt;left);
	printPostorder(node-&gt;right);
	printf("%s ", node-&gt;data.c_str());
}


void print_inorder(struct node* node)
{
	if (node == NULL)
		return;

	printInorder(node-&gt;left);
	printf("%s ", node-&gt;data.c_str());
	printInorder(node-&gt;right);
}


void print_preorder(struct node* node)
{
	if (node == NULL)
		return;


	printf("%s ", node-&gt;data.c_str());
	printPreorder(node-&gt;left);
	printPreorder(node-&gt;right);
}

int main()
{
	//((a+b)*(c-d))/(e+f)
	struct node *root = newNode("/");

	//levo poddrvo
	root-&gt;left = newNode("*");
	root-&gt;left-&gt;left = newNode("+");
	root-&gt;left-&gt;right = newNode("-");
	root-&gt;left-&gt;left-&gt;left = newNode("a");
	root-&gt;left-&gt;left-&gt;right = newNode("b");
	root-&gt;left-&gt;right-&gt;left = newNode("c");
	root-&gt;left-&gt;right-&gt;right = newNode("d");

	//desno poddrvo
	root-&gt;right = newNode("+");
	root-&gt;right-&gt;left = newNode("e");
	root-&gt;right-&gt;right = newNode("f");


	printf("\n Preorder minuvanje:  \n");
	printPreorder(root);

	printf("\n Inorder minuvanje: \n");
	printInorder(root);

	printf("\n Postorder minuvanje: \n");
	printPostorder(root);

	return 0;
}
